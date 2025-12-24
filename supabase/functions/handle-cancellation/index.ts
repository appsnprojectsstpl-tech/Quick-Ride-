import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CancellationRequest {
  ride_id: string
  cancelled_by: 'rider' | 'captain'
  user_id: string
  captain_id?: string
  reason?: string
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

    const { ride_id, cancelled_by, user_id, captain_id, reason }: CancellationRequest = await req.json()

    console.log(`[handle-cancellation] Processing cancellation for ride ${ride_id} by ${cancelled_by}`)

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

    // Check if ride can be cancelled
    const cancellableStatuses = ['pending', 'matched', 'captain_arriving', 'waiting_for_rider']
    if (!cancellableStatuses.includes(ride.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot cancel ride in status: ${ride.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Calculate time since match
    const matchedAt = ride.matched_at ? new Date(ride.matched_at) : null
    const now = new Date()
    const secondsSinceMatch = matchedAt 
      ? Math.floor((now.getTime() - matchedAt.getTime()) / 1000) 
      : 0

    // Get applicable penalty
    const { data: penalties } = await supabase
      .from('cancellation_penalties')
      .select('*')
      .eq('cancelled_by', cancelled_by)
      .eq('ride_status', ride.status)
      .eq('is_active', true)
      .or(`city.eq.default,city.eq.${ride.city || 'default'}`)
      .order('city', { ascending: false })

    // Find matching penalty based on time
    let applicablePenalty = null
    for (const penalty of penalties || []) {
      const minTime = penalty.min_time_after_match_seconds || 0
      const maxTime = penalty.max_time_after_match_seconds

      if (secondsSinceMatch >= minTime && (maxTime === null || secondsSinceMatch <= maxTime)) {
        applicablePenalty = penalty
        break
      }
    }

    const cancellationFee = applicablePenalty?.penalty_amount || 0
    const penaltyType = applicablePenalty?.penalty_type || 'fee'

    console.log(`[handle-cancellation] Time since match: ${secondsSinceMatch}s, Fee: ${cancellationFee}, Type: ${penaltyType}`)

    // Update ride as cancelled
    await supabase
      .from('rides')
      .update({
        status: 'cancelled',
        cancelled_at: now.toISOString(),
        cancellation_reason: reason || 'User cancelled',
        cancelled_by: cancelled_by,
        cancelled_by_user_id: user_id,
        cancellation_fee: cancellationFee
      })
      .eq('id', ride_id)

    // Handle captain-specific actions
    if (cancelled_by === 'captain' && (captain_id || ride.captain_id)) {
      const captId = captain_id || ride.captain_id

      // Reset captain to online
      await supabase
        .from('captains')
        .update({ status: 'online' })
        .eq('id', captId)

      // Update captain metrics
      const { data: metrics } = await supabase
        .from('captain_metrics')
        .select('*')
        .eq('captain_id', captId)
        .single()

      const dailyCancelCount = (metrics?.daily_cancellation_count || 0) + 1
      const totalCancelled = (metrics?.total_rides_cancelled || 0) + 1

      // Apply cooldown if excessive cancellations
      let cooldownUntil = null
      if (dailyCancelCount >= 3 && penaltyType === 'cooldown') {
        const cooldownMinutes = applicablePenalty?.cooldown_minutes || 30
        cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString()
        
        // Also set captain offline
        await supabase
          .from('captains')
          .update({ status: 'offline' })
          .eq('id', captId)

        console.log(`[handle-cancellation] Captain ${captId} placed in ${cooldownMinutes}min cooldown`)
      }

      await supabase
        .from('captain_metrics')
        .update({
          daily_cancellation_count: dailyCancelCount,
          total_rides_cancelled: totalCancelled,
          cooldown_until: cooldownUntil,
          updated_at: now.toISOString()
        })
        .eq('captain_id', captId)
    } else if (cancelled_by === 'rider' && ride.captain_id) {
      // Reset captain to online if rider cancelled
      await supabase
        .from('captains')
        .update({ status: 'online' })
        .eq('id', ride.captain_id)
    }

    // Expire any pending offers
    await supabase
      .from('ride_offers')
      .update({
        response_status: 'expired',
        responded_at: now.toISOString()
      })
      .eq('ride_id', ride_id)
      .eq('response_status', 'pending')

    console.log(`[handle-cancellation] Ride ${ride_id} cancelled by ${cancelled_by}, fee: ₹${cancellationFee}`)

    return new Response(
      JSON.stringify({
        success: true,
        action: 'cancelled',
        cancellation_fee: cancellationFee,
        penalty_type: penaltyType,
        message: cancellationFee > 0 
          ? `Ride cancelled. Cancellation fee: ₹${cancellationFee}` 
          : 'Ride cancelled successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[handle-cancellation] Error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
