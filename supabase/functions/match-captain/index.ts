import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MatchRequest {
  ride_id: string
  pickup_lat: number
  pickup_lng: number
  vehicle_type: 'bike' | 'auto' | 'cab'
  radius_km?: number
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

    const { ride_id, pickup_lat, pickup_lng, vehicle_type, radius_km = 5 }: MatchRequest = await req.json()

    // Find online, verified captains with matching vehicle type within radius
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
      throw new Error(`Failed to fetch vehicles: ${vehiclesError.message}`)
    }

    // Filter online captains and calculate distance
    const availableCaptains = (vehicles || [])
      .filter((v: any) => 
        v.captains?.status === 'online' && 
        v.captains?.is_verified === true &&
        v.captains?.current_lat && 
        v.captains?.current_lng
      )
      .map((v: any) => {
        const captain = v.captains
        // Calculate distance using Haversine formula
        const R = 6371
        const dLat = (captain.current_lat - pickup_lat) * Math.PI / 180
        const dLon = (captain.current_lng - pickup_lng) * Math.PI / 180
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(pickup_lat * Math.PI / 180) * Math.cos(captain.current_lat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = R * c

        return {
          captain_id: captain.id,
          user_id: captain.user_id,
          vehicle_id: v.id,
          vehicle_make: v.make,
          vehicle_model: v.model,
          registration_number: v.registration_number,
          distance_km: distance,
          eta_mins: Math.round(distance * 3), // Rough ETA estimate
          rating: captain.rating
        }
      })
      .filter((c: any) => c.distance_km <= radius_km)
      .sort((a: any, b: any) => a.distance_km - b.distance_km)

    if (availableCaptains.length === 0) {
      return new Response(
        JSON.stringify({ 
          matched: false, 
          message: 'No captains available nearby. Please try again.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Select the nearest captain
    const selectedCaptain = availableCaptains[0]

    // Generate OTP for ride verification
    const otp = Math.floor(1000 + Math.random() * 9000).toString()

    // Update ride with captain assignment
    const { error: updateError } = await supabase
      .from('rides')
      .update({
        captain_id: selectedCaptain.captain_id,
        vehicle_id: selectedCaptain.vehicle_id,
        status: 'matched',
        matched_at: new Date().toISOString(),
        otp: otp
      })
      .eq('id', ride_id)

    if (updateError) {
      throw new Error(`Failed to update ride: ${updateError.message}`)
    }

    // Update captain status to on_ride
    const { error: captainUpdateError } = await supabase
      .from('captains')
      .update({ status: 'on_ride' })
      .eq('id', selectedCaptain.captain_id)

    if (captainUpdateError) {
      console.error('Failed to update captain status:', captainUpdateError)
    }

    // Get captain profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, phone, avatar_url')
      .eq('user_id', selectedCaptain.user_id)
      .single()

    console.log(`Matched ride ${ride_id} with captain ${selectedCaptain.captain_id}`)

    return new Response(
      JSON.stringify({
        matched: true,
        captain: {
          id: selectedCaptain.captain_id,
          name: profile?.name || 'Captain',
          phone: profile?.phone,
          avatar_url: profile?.avatar_url,
          rating: selectedCaptain.rating,
          vehicle: {
            id: selectedCaptain.vehicle_id,
            make: selectedCaptain.vehicle_make,
            model: selectedCaptain.vehicle_model,
            registration_number: selectedCaptain.registration_number
          },
          eta_mins: selectedCaptain.eta_mins,
          distance_km: Math.round(selectedCaptain.distance_km * 10) / 10
        },
        otp: otp
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Captain matching error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
