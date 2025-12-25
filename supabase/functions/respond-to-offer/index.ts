import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void
}

// Dynamic CORS based on origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedPatterns = [
    /^https:\/\/.*\.lovableproject\.com$/,
    /^https:\/\/.*\.lovable\.app$/,
    /^capacitor:\/\/localhost$/,
    /^http:\/\/localhost:\d+$/
  ];
  
  const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://lovable.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Input validation schema
const RespondRequestSchema = z.object({
  offer_id: z.string().uuid(),
  captain_id: z.string().uuid(),
  response: z.enum(['accept', 'decline']),
  decline_reason: z.string().max(500).optional(),
})

// Sanitize error for client response - generic messages only
function sanitizeError(error: unknown): string {
  console.error('[respond-to-offer] Error:', error)
  if (error instanceof z.ZodError) {
    return 'Invalid request parameters'
  }
  return 'Unable to process request. Please try again.'
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const rawInput = await req.json()
    const input = RespondRequestSchema.parse(rawInput)
    const { offer_id, captain_id, response, decline_reason } = input

    console.log(`[respond-to-offer] Captain ${captain_id} responding ${response} to offer ${offer_id}`)

    const { data: offer, error: offerError } = await supabase
      .from('ride_offers')
      .select('*, rides!inner(*)')
      .eq('id', offer_id)
      .single()

    if (offerError || !offer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unable to process request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    if (offer.captain_id !== captain_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    if (offer.response_status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unable to process request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (new Date(offer.expires_at) < new Date()) {
      await supabase
        .from('ride_offers')
        .update({ response_status: 'expired', responded_at: new Date().toISOString() })
        .eq('id', offer_id)

      return new Response(
        JSON.stringify({ success: false, error: 'Unable to process request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const ride = offer.rides

    if (response === 'accept') {
      await supabase
        .from('ride_offers')
        .update({
          response_status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', offer_id)

      await supabase
        .from('rides')
        .update({
          status: 'captain_arriving',
          captain_id: captain_id,
          matched_at: new Date().toISOString()
        })
        .eq('id', ride.id)

      await supabase
        .from('captains')
        .update({ status: 'on_ride' })
        .eq('id', captain_id)

      const { data: captainData } = await supabase
        .from('captains')
        .select('user_id, rating')
        .eq('id', captain_id)
        .single()

      const { data: captainProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', captainData?.user_id)
        .single()

      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('make, model, registration_number')
        .eq('captain_id', captain_id)
        .eq('is_active', true)
        .single()

      if (ride.rider_id) {
        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              user_ids: [ride.rider_id],
              title: '✅ Ride Confirmed!',
              body: `${captainProfile?.name || 'Your captain'} is on the way\n${vehicle?.make} ${vehicle?.model} - ${vehicle?.registration_number}`,
              data: {
                type: 'ride_accepted',
                ride_id: ride.id,
              },
              priority: 'high'
            }),
          })
          console.log('[respond-to-offer] Push notification sent to rider')
        } catch (notifError) {
          console.error('[respond-to-offer] Failed to send push notification:', notifError)
        }
      }

      console.log(`[respond-to-offer] Captain ${captain_id} accepted ride ${ride.id}`)

      return new Response(
        JSON.stringify({
          success: true,
          action: 'accepted',
          ride: {
            id: ride.id,
            pickup_lat: ride.pickup_lat,
            pickup_lng: ride.pickup_lng,
            pickup_address: ride.pickup_address,
            drop_lat: ride.drop_lat,
            drop_lng: ride.drop_lng,
            drop_address: ride.drop_address,
            otp: ride.otp,
            final_fare: ride.final_fare,
            vehicle_type: ride.vehicle_type
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      await supabase
        .from('ride_offers')
        .update({
          response_status: 'declined',
          responded_at: new Date().toISOString(),
          decline_reason: decline_reason || 'No reason provided'
        })
        .eq('id', offer_id)

      const excludedIds = ride.excluded_captain_ids || []
      excludedIds.push(captain_id)

      await supabase
        .from('captains')
        .update({ status: 'online' })
        .eq('id', captain_id)

      await supabase
        .from('rides')
        .update({
          status: 'pending',
          captain_id: null,
          vehicle_id: null,
          matched_at: null,
          excluded_captain_ids: excludedIds
        })
        .eq('id', ride.id)

      console.log(`[respond-to-offer] Captain ${captain_id} declined ride ${ride.id}`)

      const { data: config } = await supabase
        .from('matching_config')
        .select('*')
        .eq('city', 'default')
        .single()

      const maxOffers = config?.max_offers_per_ride || 5

      if (excludedIds.length < maxOffers) {
        console.log(`[respond-to-offer] Triggering background re-match for ride ${ride.id}`)
        
        EdgeRuntime.waitUntil((async () => {
          try {
            await new Promise(resolve => setTimeout(resolve, 500))
            
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/match-captain-v2`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                ride_id: ride.id,
                pickup_lat: ride.pickup_lat,
                pickup_lng: ride.pickup_lng,
                vehicle_type: ride.vehicle_type,
                estimated_fare: ride.final_fare || 0,
                estimated_distance_km: ride.estimated_distance_km || 5,
                estimated_duration_mins: ride.estimated_duration_mins || 15,
              }),
            })
          } catch (e) {
            console.error('[respond-to-offer] Background re-match failed:', e)
          }
        })())
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'declined',
          message: 'Offer declined',
          captains_tried: excludedIds.length,
          max_captains: maxOffers
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})