import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function validateAndApplyPromo(supabase: any, code: string, totalFare: number) {
  const now = new Date().toISOString()
  
  const { data: promo, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .lte('valid_from', now)
    .gte('valid_until', now)
    .single()

  if (error || !promo) {
    return { discount: 0, promoApplied: null, error: 'Invalid or expired promo code' }
  }

  // Check usage limit
  if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
    return { discount: 0, promoApplied: null, error: 'Promo code usage limit reached' }
  }

  // Check minimum ride value
  if (promo.min_ride_value && totalFare < promo.min_ride_value) {
    return { discount: 0, promoApplied: null, error: `Minimum ride value of ₹${promo.min_ride_value} required` }
  }

  // Calculate discount
  let discount = 0
  if (promo.discount_type === 'percentage') {
    discount = (totalFare * promo.discount_value) / 100
    if (promo.max_discount && discount > promo.max_discount) {
      discount = promo.max_discount
    }
  } else {
    discount = promo.discount_value
  }

  return { 
    discount, 
    promoApplied: { 
      code: promo.code, 
      discount_type: promo.discount_type,
      discount_value: promo.discount_value 
    }, 
    error: null 
  }
}

interface FareRequest {
  pickup_lat: number
  pickup_lng: number
  drop_lat: number
  drop_lng: number
  vehicle_type: 'bike' | 'auto' | 'cab'
  city?: string
  promo_code?: string
}

interface PromoCode {
  id: string
  code: string
  discount_type: string
  discount_value: number
  max_discount: number | null
  min_ride_value: number | null
  is_active: boolean
  valid_from: string
  valid_until: string
  usage_limit: number | null
  used_count: number | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { pickup_lat, pickup_lng, drop_lat, drop_lng, vehicle_type, city = 'bangalore', promo_code }: FareRequest = await req.json()

    // Calculate distance using Haversine formula
    const R = 6371 // Earth's radius in km
    const dLat = (drop_lat - pickup_lat) * Math.PI / 180
    const dLon = (drop_lng - pickup_lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(pickup_lat * Math.PI / 180) * Math.cos(drop_lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c * 1.3 // Add 30% for road distance approximation

    // Estimate duration (assuming average speed based on vehicle type)
    const avgSpeed = vehicle_type === 'bike' ? 25 : vehicle_type === 'auto' ? 20 : 30 // km/h
    const duration = (distance / avgSpeed) * 60 // minutes

    // Get pricing config
    const { data: pricing, error: pricingError } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('city', city.toLowerCase())
      .eq('vehicle_type', vehicle_type)
      .eq('is_active', true)
      .single()

    if (pricingError || !pricing) {
      // Default pricing if not found
      const defaultPricing = {
        base_fare: vehicle_type === 'bike' ? 15 : vehicle_type === 'auto' ? 25 : 50,
        per_km_rate: vehicle_type === 'bike' ? 8 : vehicle_type === 'auto' ? 12 : 15,
        per_min_rate: vehicle_type === 'bike' ? 1 : vehicle_type === 'auto' ? 1.5 : 2,
        min_fare: vehicle_type === 'bike' ? 25 : vehicle_type === 'auto' ? 40 : 80,
        surge_multiplier: 1.0
      }

      const baseFare = defaultPricing.base_fare
      const distanceFare = distance * defaultPricing.per_km_rate
      const timeFare = duration * defaultPricing.per_min_rate
      const totalFare = Math.max(baseFare + distanceFare + timeFare, defaultPricing.min_fare)

      // Apply promo code discount for default pricing
      let discount = 0
      let promoApplied = null
      let promoError = null

      if (promo_code) {
        const promoResult = await validateAndApplyPromo(supabase, promo_code, totalFare)
        discount = promoResult.discount
        promoApplied = promoResult.promoApplied
        promoError = promoResult.error
      }

      const finalFare = Math.max(totalFare - discount, 0)

      return new Response(
        JSON.stringify({
          distance_km: Math.round(distance * 10) / 10,
          duration_mins: Math.round(duration),
          base_fare: Math.round(baseFare),
          distance_fare: Math.round(distanceFare),
          time_fare: Math.round(timeFare),
          surge_multiplier: 1.0,
          total_fare: Math.round(totalFare),
          discount: Math.round(discount),
          final_fare: Math.round(finalFare),
          promo_applied: promoApplied,
          promo_error: promoError
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate fare with pricing config
    const baseFare = pricing.base_fare
    const distanceFare = distance * pricing.per_km_rate
    const timeFare = duration * pricing.per_min_rate
    const surgeMultiplier = 1.0 // Could calculate based on demand
    const totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier
    const fareBeforeDiscount = Math.max(totalFare, pricing.min_fare)

    // Apply promo code discount
    let discount = 0
    let promoApplied = null
    let promoError = null

    if (promo_code) {
      const promoResult = await validateAndApplyPromo(supabase, promo_code, fareBeforeDiscount)
      discount = promoResult.discount
      promoApplied = promoResult.promoApplied
      promoError = promoResult.error
    }

    const finalFare = Math.max(fareBeforeDiscount - discount, 0)

    console.log(`Fare calculated: ${vehicle_type}, ${distance.toFixed(2)}km, ₹${finalFare.toFixed(0)}, discount: ₹${discount}`)

    return new Response(
      JSON.stringify({
        distance_km: Math.round(distance * 10) / 10,
        duration_mins: Math.round(duration),
        base_fare: Math.round(baseFare),
        distance_fare: Math.round(distanceFare),
        time_fare: Math.round(timeFare),
        surge_multiplier: surgeMultiplier,
        total_fare: Math.round(fareBeforeDiscount),
        discount: Math.round(discount),
        final_fare: Math.round(finalFare),
        promo_applied: promoApplied,
        promo_error: promoError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Fare calculation error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
