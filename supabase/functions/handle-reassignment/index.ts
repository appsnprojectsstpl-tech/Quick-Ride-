import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReassignmentRequest {
  ride_id: string
  reason: 'captain_cancelled' | 'captain_delay' | 'captain_no_response' | 'all_declined'
  captain_id?: string
  cancellation_reason?: string
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

    const { ride_id, reason, captain_id, cancellation_reason }: ReassignmentRequest = await req.json()

    console.log(`[handle-reassignment] Processing reassignment for ride ${ride_id}, reason: ${reason}`)

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', ride_id)
      .single()

    if (rideError || !ride) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ride not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if ride can be reassigned
    const reassignableStatuses = ['matched', 'captain_arriving', 'waiting_for_rider']
    if (!reassignableStatuses.includes(ride.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot reassign ride in status: ${ride.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const currentCaptainId = captain_id || ride.captain_id
    const excludedIds = ride.excluded_captain_ids || []
    
    if (currentCaptainId && !excludedIds.includes(currentCaptainId)) {
      excludedIds.push(currentCaptainId)
    }

    const reassignmentCount = (ride.reassignment_count || 0) + 1

    // Get matching config
    const { data: config } = await supabase
      .from('matching_config')
      .select('*')
      .eq('city', 'default')
      .single()

    const maxRetries = config?.max_retry_attempts || 3

    // Check if we've exceeded max retries
    if (reassignmentCount > maxRetries) {
      // Cancel the ride - no captains available after max retries
      await supabase
        .from('rides')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'No captains available after multiple attempts',
          cancelled_by: 'system'
        })
        .eq('id', ride_id)

      // Reset captain status if there was one
      if (currentCaptainId) {
        await supabase
          .from('captains')
          .update({ status: 'online' })
          .eq('id', currentCaptainId)
      }

      console.log(`[handle-reassignment] Ride ${ride_id} cancelled after ${maxRetries} reassignment attempts`)

      return new Response(
        JSON.stringify({
          success: false,
          action: 'cancelled',
          message: 'No captains available after multiple attempts',
          reassignment_count: reassignmentCount
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle captain-specific actions
    if (currentCaptainId) {
      // Reset captain status
      await supabase
        .from('captains')
        .update({ status: 'online' })
        .eq('id', currentCaptainId)

      // Update captain metrics for cancellation
      if (reason === 'captain_cancelled') {
        const { data: metrics } = await supabase
          .from('captain_metrics')
          .select('*')
          .eq('captain_id', currentCaptainId)
          .single()

        const dailyCancelCount = (metrics?.daily_cancellation_count || 0) + 1
        const totalCancelled = (metrics?.total_rides_cancelled || 0) + 1
        const totalCompleted = metrics?.total_rides_completed || 0
        const cancellationRate = totalCompleted > 0 
          ? (totalCancelled / (totalCompleted + totalCancelled)) * 100 
          : 0

        // Check if captain needs cooldown (3+ cancellations today)
        let cooldownUntil = null
        if (dailyCancelCount >= 3) {
          cooldownUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min cooldown
          console.log(`[handle-reassignment] Captain ${currentCaptainId} placed in 30min cooldown (${dailyCancelCount} cancellations today)`)
        }

        await supabase
          .from('captain_metrics')
          .update({
            daily_cancellation_count: dailyCancelCount,
            total_rides_cancelled: totalCancelled,
            cancellation_rate: cancellationRate,
            cooldown_until: cooldownUntil,
            updated_at: new Date().toISOString()
          })
          .eq('captain_id', currentCaptainId)

        // Expire any pending offers for this captain on this ride
        await supabase
          .from('ride_offers')
          .update({
            response_status: 'declined',
            responded_at: new Date().toISOString(),
            decline_reason: cancellation_reason || 'Captain cancelled'
          })
          .eq('ride_id', ride_id)
          .eq('captain_id', currentCaptainId)
          .eq('response_status', 'pending')
      }
    }

    // Expand radius for retry
    const currentRadius = ride.current_radius_km || 1.5
    const expansionStep = config?.radius_expansion_step_km || 1.0
    const maxRadius = config?.max_radius_km || 5.0
    const newRadius = Math.min(currentRadius + expansionStep, maxRadius)

    // Reset ride for re-matching
    await supabase
      .from('rides')
      .update({
        status: 'pending',
        captain_id: null,
        vehicle_id: null,
        matched_at: null,
        excluded_captain_ids: excludedIds,
        reassignment_count: reassignmentCount,
        current_radius_km: newRadius
      })
      .eq('id', ride_id)

    console.log(`[handle-reassignment] Ride ${ride_id} reset for re-matching (attempt ${reassignmentCount}, radius ${newRadius}km, ${excludedIds.length} captains excluded)`)

    return new Response(
      JSON.stringify({
        success: true,
        action: 'reassigned',
        message: 'Ride reset for re-matching',
        reassignment_count: reassignmentCount,
        excluded_captains: excludedIds.length,
        new_radius_km: newRadius,
        max_retries: maxRetries
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[handle-reassignment] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
