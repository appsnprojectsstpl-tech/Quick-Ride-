import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const CancellationRequestSchema = z.object({
  ride_id: z.string().uuid(),
  cancelled_by: z.enum(['rider', 'captain']),
  user_id: z.string().uuid(),
  captain_id: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
})

// Sanitize error for client response
function sanitizeError(error: unknown): string {
  console.error('[handle-cancellation] Error:', error)
  if (error instanceof z.ZodError) {
    return 'Invalid request parameters'
  }
  if (error instanceof Error) {
    if (error.message.includes('not found')) return 'Ride not found'
    if (error.message.includes('Cannot cancel')) return error.message
  }
  return 'An error occurred processing your request'
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

    // Validate input
    const rawInput = await req.json()
    const input = CancellationRequestSchema.parse(rawInput)
    const { ride_id, cancelled_by, user_id, captain_id, reason } = input

    console.log(`[handle-cancellation] Processing cancellation for ride ${ride_id} by ${cancelled_by}`)

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

    const cancellableStatuses = ['pending', 'matched', 'captain_arriving', 'waiting_for_rider']
    if (!cancellableStatuses.includes(ride.status)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Cannot cancel ride at this stage' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const matchedAt = ride.matched_at ? new Date(ride.matched_at) : null
    const now = new Date()
    const secondsSinceMatch = matchedAt 
      ? Math.floor((now.getTime() - matchedAt.getTime()) / 1000) 
      : 0

    const { data: penalties } = await supabase
      .from('cancellation_penalties')
      .select('*')
      .eq('cancelled_by', cancelled_by)
      .eq('ride_status', ride.status)
      .eq('is_active', true)
      .or(`city.eq.default,city.eq.${ride.city || 'default'}`)
      .order('city', { ascending: false })

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

    console.log(`[handle-cancellation] Time since match: ${secondsSinceMatch}s, Fee: ${cancellationFee}`)

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

    if (cancelled_by === 'captain' && (captain_id || ride.captain_id)) {
      const captId = captain_id || ride.captain_id

      await supabase
        .from('captains')
        .update({ status: 'online' })
        .eq('id', captId)

      const { data: metrics } = await supabase
        .from('captain_metrics')
        .select('*')
        .eq('captain_id', captId)
        .single()

      const dailyCancelCount = (metrics?.daily_cancellation_count || 0) + 1
      const totalCancelled = (metrics?.total_rides_cancelled || 0) + 1

      let cooldownUntil = null
      if (dailyCancelCount >= 3 && penaltyType === 'cooldown') {
        const cooldownMinutes = applicablePenalty?.cooldown_minutes || 30
        cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000).toISOString()
        
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
      await supabase
        .from('captains')
        .update({ status: 'online' })
        .eq('id', ride.captain_id)
    }

    await supabase
      .from('ride_offers')
      .update({
        response_status: 'expired',
        responded_at: now.toISOString()
      })
      .eq('ride_id', ride_id)
      .eq('response_status', 'pending')

    // Send push notification to the other party
    try {
      let notifyUserIds: string[] = []
      let notifyTitle = ''
      let notifyBody = ''

      if (cancelled_by === 'rider' && ride.captain_id) {
        const { data: captainData } = await supabase
          .from('captains')
          .select('user_id')
          .eq('id', ride.captain_id)
          .single()
        
        if (captainData?.user_id) {
          notifyUserIds = [captainData.user_id]
          notifyTitle = '❌ Ride Cancelled by Rider'
          notifyBody = reason || 'The rider has cancelled this ride'
        }
      } else if (cancelled_by === 'captain' && ride.rider_id) {
        notifyUserIds = [ride.rider_id]
        notifyTitle = '🔄 Finding New Captain'
        notifyBody = 'Your captain cancelled. We\'re finding you a new one.'
      }

      if (notifyUserIds.length > 0) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            user_ids: notifyUserIds,
            title: notifyTitle,
            body: notifyBody,
            data: {
              type: 'ride_cancelled',
              ride_id,
              cancelled_by,
            },
            priority: 'high'
          }),
        })
        console.log('[handle-cancellation] Push notification sent')
      }
    } catch (notifError) {
      console.error('[handle-cancellation] Failed to send push notification:', notifError)
    }

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
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
