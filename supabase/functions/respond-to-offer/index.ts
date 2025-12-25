import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RespondRequest {
  offer_id: string
  captain_id: string
  response: 'accept' | 'decline'
  decline_reason?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { offer_id, captain_id, response, decline_reason }: RespondRequest = await req.json()

    console.log(`[respond-to-offer] Captain ${captain_id} responding ${response} to offer ${offer_id}`)

    // Get the offer
    const { data: offer, error: offerError } = await supabase
      .from('ride_offers')
      .select('*, rides!inner(*)')
      .eq('id', offer_id)
      .single()

    if (offerError || !offer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Offer not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Verify captain matches
    if (offer.captain_id !== captain_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Offer not assigned to this captain' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Check if offer already responded to
    if (offer.response_status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'Offer already responded to', status: offer.response_status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if offer expired
    if (new Date(offer.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('ride_offers')
        .update({ response_status: 'expired', responded_at: new Date().toISOString() })
        .eq('id', offer_id)

      return new Response(
        JSON.stringify({ success: false, error: 'Offer has expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const ride = offer.rides

    if (response === 'accept') {
      // Update offer as accepted
      await supabase
        .from('ride_offers')
        .update({
          response_status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', offer_id)

      // Update ride status
      await supabase
        .from('rides')
        .update({
          status: 'captain_arriving',
          captain_id: captain_id,
          matched_at: new Date().toISOString()
        })
        .eq('id', ride.id)

      // Update captain status
      await supabase
        .from('captains')
        .update({ status: 'on_ride' })
        .eq('id', captain_id)

      // Get captain profile for notification
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

      // Send push notification to rider
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
      // Decline the offer
      await supabase
        .from('ride_offers')
        .update({
          response_status: 'declined',
          responded_at: new Date().toISOString(),
          decline_reason: decline_reason || 'No reason provided'
        })
        .eq('id', offer_id)

      // Add captain to excluded list
      const excludedIds = ride.excluded_captain_ids || []
      excludedIds.push(captain_id)

      // Reset captain status to online
      await supabase
        .from('captains')
        .update({ status: 'online' })
        .eq('id', captain_id)

      // Update ride to trigger re-matching
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

      console.log(`[respond-to-offer] Captain ${captain_id} declined ride ${ride.id}: ${decline_reason}`)

      // Get matching config for retry
      const { data: config } = await supabase
        .from('matching_config')
        .select('*')
        .eq('city', 'default')
        .single()

      const maxOffers = config?.max_offers_per_ride || 5

      // Check if we should find next captain
      if (excludedIds.length < maxOffers) {
        // Trigger re-matching automatically using EdgeRuntime.waitUntil for background task
        console.log(`[respond-to-offer] Triggering background re-match for ride ${ride.id} (${excludedIds.length}/${maxOffers} captains tried)`)
        
        // Use waitUntil to not block response
        EdgeRuntime.waitUntil((async () => {
          try {
            // Small delay to let DB updates propagate
            await new Promise(resolve => setTimeout(resolve, 500))
            
            const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/match-captain-v2`, {
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
            
            const result = await response.json()
            console.log(`[respond-to-offer] Background re-match result:`, result)
          } catch (e) {
            console.error('[respond-to-offer] Background re-match failed:', e)
          }
        })())
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'declined',
          message: 'Offer declined, ride will be re-matched',
          captains_tried: excludedIds.length,
          max_captains: maxOffers
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[respond-to-offer] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
