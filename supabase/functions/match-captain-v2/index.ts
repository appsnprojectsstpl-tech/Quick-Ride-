import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

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
const MatchRequestSchema = z.object({
  ride_id: z.string().uuid(),
  pickup_lat: z.number().min(-90).max(90),
  pickup_lng: z.number().min(-180).max(180),
  vehicle_type: z.enum(['bike', 'auto', 'cab']),
  city: z.string().max(100).optional().default('default'),
  estimated_fare: z.number().nonnegative().optional().default(0),
  estimated_distance_km: z.number().nonnegative().optional().default(0),
  estimated_duration_mins: z.number().nonnegative().optional().default(0),
})

// Sanitize error for client response - generic messages only
function sanitizeError(error: unknown): string {
  console.error('[match-captain-v2] Error:', error)
  if (error instanceof z.ZodError) {
    return 'Invalid request parameters'
  }
  return 'Unable to process request. Please try again.'
}

interface CaptainCandidate {
  captain_id: string
  user_id: string
  vehicle_id: string
  vehicle_make: string
  vehicle_model: string
  registration_number: string
  distance_km: number
  eta_mins: number
  rating: number
  acceptance_rate: number
  cancellation_rate: number
  score: number
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function calculateCaptainScore(
  captain: any,
  metrics: any,
  config: any,
  maxDistance: number
): number {
  const etaScore = 1 - Math.min(captain.distance_km / maxDistance, 1)
  const acceptanceScore = (metrics?.acceptance_rate || 100) / 100
  const ratingScore = (captain.rating || 5) / 5
  const cancellationScore = 1 - ((metrics?.cancellation_rate || 0) / 100)

  const score = 
    etaScore * (config.score_weight_eta || 0.40) +
    acceptanceScore * (config.score_weight_acceptance || 0.25) +
    ratingScore * (config.score_weight_rating || 0.20) +
    cancellationScore * (config.score_weight_cancellation || 0.15)

  return Math.round(score * 1000) / 1000
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
    const input = MatchRequestSchema.parse(rawInput)
    const { ride_id, pickup_lat, pickup_lng, vehicle_type, city, estimated_fare, estimated_distance_km, estimated_duration_mins } = input

    console.log(`[match-captain-v2] Starting match for ride ${ride_id}`)

    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('excluded_captain_ids, current_radius_km, matching_attempts')
      .eq('id', ride_id)
      .single()

    if (rideError) {
      console.error('[match-captain-v2] Ride not found:', rideError)
      return new Response(
        JSON.stringify({ matched: false, error: 'Unable to process request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const excludedCaptainIds = ride?.excluded_captain_ids || []
    let currentRadius = ride?.current_radius_km || 1.5
    const matchingAttempts = (ride?.matching_attempts || 0) + 1

    const { data: config } = await supabase
      .from('matching_config')
      .select('*')
      .or(`city.eq.${city},city.eq.default`)
      .eq('is_active', true)
      .order('city', { ascending: false })
      .limit(1)
      .single()

    const matchConfig = config || {
      initial_radius_km: 1.5,
      max_radius_km: 5.0,
      radius_expansion_step_km: 1.0,
      offer_timeout_seconds: 15,
      max_offers_per_ride: 5,
      score_weight_eta: 0.40,
      score_weight_acceptance: 0.25,
      score_weight_rating: 0.20,
      score_weight_cancellation: 0.15
    }

    if (matchingAttempts > 1) {
      currentRadius = Math.min(
        currentRadius + matchConfig.radius_expansion_step_km,
        matchConfig.max_radius_km
      )
      console.log(`[match-captain-v2] Expanding radius to ${currentRadius}km (attempt ${matchingAttempts})`)
    }

    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select(`
        id,
        captain_id,
        make,
        model,
        registration_number,
        captains!inner (
          id,
          user_id,
          current_lat,
          current_lng,
          status,
          is_verified,
          rating
        )
      `)
      .eq('vehicle_type', vehicle_type)
      .eq('is_active', true)

    if (vehiclesError) {
      console.error('[match-captain-v2] Failed to fetch vehicles:', vehiclesError)
      return new Response(
        JSON.stringify({ matched: false, error: 'Unable to process request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const captainIds = vehicles?.map((v: any) => v.captain_id) || []
    const { data: allMetrics } = await supabase
      .from('captain_metrics')
      .select('*')
      .in('captain_id', captainIds)

    const metricsMap = new Map((allMetrics || []).map((m: any) => [m.captain_id, m]))

    const now = new Date()
    const candidates: CaptainCandidate[] = (vehicles || [])
      .filter((v: any) => {
        const captain = v.captains
        if (captain?.status !== 'online') return false
        if (captain?.is_verified !== true) return false
        if (!captain?.current_lat || !captain?.current_lng) return false
        if (excludedCaptainIds.includes(captain.id)) return false

        const metrics = metricsMap.get(captain.id)
        if (metrics?.cooldown_until && new Date(metrics.cooldown_until) > now) {
          return false
        }

        return true
      })
      .map((v: any) => {
        const captain = v.captains
        const metrics = metricsMap.get(captain.id)
        const distance = calculateDistance(pickup_lat, pickup_lng, captain.current_lat, captain.current_lng)

        return {
          captain_id: captain.id,
          user_id: captain.user_id,
          vehicle_id: v.id,
          vehicle_make: v.make,
          vehicle_model: v.model,
          registration_number: v.registration_number,
          distance_km: distance,
          eta_mins: Math.round(distance * 3),
          rating: captain.rating || 5,
          acceptance_rate: metrics?.acceptance_rate || 100,
          cancellation_rate: metrics?.cancellation_rate || 0,
          score: 0
        }
      })
      .filter((c: CaptainCandidate) => c.distance_km <= currentRadius)

    candidates.forEach(candidate => {
      const metrics = metricsMap.get(candidate.captain_id)
      candidate.score = calculateCaptainScore(candidate, metrics, matchConfig, currentRadius)
    })

    candidates.sort((a, b) => b.score - a.score)
    const topCandidates = candidates.slice(0, matchConfig.max_offers_per_ride)

    console.log(`[match-captain-v2] Found ${candidates.length} candidates, selected top ${topCandidates.length}`)

    if (topCandidates.length === 0) {
      if (currentRadius < matchConfig.max_radius_km) {
        await supabase
          .from('rides')
          .update({
            current_radius_km: currentRadius + matchConfig.radius_expansion_step_km,
            matching_attempts: matchingAttempts
          })
          .eq('id', ride_id)

        return new Response(
          JSON.stringify({ 
            matched: false,
            retry: true,
            message: 'No captains in range, expanding search radius',
            current_radius_km: currentRadius,
            next_radius_km: currentRadius + matchConfig.radius_expansion_step_km
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          matched: false,
          retry: false,
          message: 'No captains available nearby. Please try again later.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const selectedCaptain = topCandidates[0]
    const offerExpiresAt = new Date(Date.now() + matchConfig.offer_timeout_seconds * 1000)
    const estimatedEarnings = Math.round(estimated_fare * 0.80)

    const { data: offer, error: offerError } = await supabase
      .from('ride_offers')
      .insert({
        ride_id,
        captain_id: selectedCaptain.captain_id,
        expires_at: offerExpiresAt.toISOString(),
        distance_to_pickup_km: Math.round(selectedCaptain.distance_km * 10) / 10,
        eta_minutes: selectedCaptain.eta_mins,
        estimated_earnings: estimatedEarnings,
        offer_sequence: 1
      })
      .select()
      .single()

    if (offerError) {
      console.error('[match-captain-v2] Failed to create offer:', offerError)
    }

    try {
      const { data: rideDetails } = await supabase
        .from('rides')
        .select('pickup_address, final_fare')
        .eq('id', ride_id)
        .single()

      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_ids: [selectedCaptain.user_id],
          title: '🚗 New Ride Request!',
          body: `Pickup: ${rideDetails?.pickup_address || 'Loading...'}\nEarning: ₹${estimatedEarnings}`,
          data: {
            type: 'ride_request',
            ride_id,
            offer_id: offer?.id,
          },
          priority: 'high'
        }),
      })
      console.log('[match-captain-v2] Push notification sent to captain')
    } catch (notifError) {
      console.error('[match-captain-v2] Failed to send push notification:', notifError)
    }

    await supabase
      .from('captain_metrics')
      .update({ 
        total_offers_received: (metricsMap.get(selectedCaptain.captain_id)?.total_offers_received || 0) + 1 
      })
      .eq('captain_id', selectedCaptain.captain_id)

    const otp = Math.floor(1000 + Math.random() * 9000).toString()

    await supabase
      .from('rides')
      .update({
        status: 'matched',
        captain_id: selectedCaptain.captain_id,
        vehicle_id: selectedCaptain.vehicle_id,
        matched_at: new Date().toISOString(),
        otp,
        current_radius_km: currentRadius,
        matching_attempts: matchingAttempts,
        last_offer_sent_at: new Date().toISOString()
      })
      .eq('id', ride_id)

    await supabase
      .from('captains')
      .update({ status: 'on_ride' })
      .eq('id', selectedCaptain.captain_id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, phone, avatar_url')
      .eq('user_id', selectedCaptain.user_id)
      .single()

    console.log(`[match-captain-v2] Matched ride ${ride_id} with captain ${selectedCaptain.captain_id} (score: ${selectedCaptain.score})`)

    return new Response(
      JSON.stringify({
        matched: true,
        offer_id: offer?.id,
        captain: {
          id: selectedCaptain.captain_id,
          name: profile?.name || 'Captain',
          phone: profile?.phone,
          avatar_url: profile?.avatar_url,
          rating: selectedCaptain.rating,
          acceptance_rate: selectedCaptain.acceptance_rate,
          vehicle: {
            id: selectedCaptain.vehicle_id,
            make: selectedCaptain.vehicle_make,
            model: selectedCaptain.vehicle_model,
            registration_number: selectedCaptain.registration_number
          },
          eta_mins: selectedCaptain.eta_mins,
          distance_km: Math.round(selectedCaptain.distance_km * 10) / 10,
          score: selectedCaptain.score
        },
        otp,
        expires_at: offerExpiresAt.toISOString(),
        other_candidates: topCandidates.slice(1).map(c => ({
          captain_id: c.captain_id,
          distance_km: Math.round(c.distance_km * 10) / 10,
          score: c.score
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})