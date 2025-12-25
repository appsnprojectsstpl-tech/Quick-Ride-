import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng, radius_km = 3 } = await req.json();

    console.log(`[get-nearby-captains] Request for lat: ${lat}, lng: ${lng}, radius: ${radius_km}km`);

    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: 'Missing lat or lng parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch online, verified captains with their vehicle info
    const { data: captains, error } = await supabase
      .from('captains')
      .select(`
        id,
        current_lat,
        current_lng,
        status,
        rating,
        location_updated_at,
        vehicles (vehicle_type)
      `)
      .eq('status', 'online')
      .eq('is_verified', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

    if (error) {
      console.error('[get-nearby-captains] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch captains' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[get-nearby-captains] Found ${captains?.length || 0} online captains`);

    // Filter by distance and format response
    const nearbyCaptains = (captains || [])
      .map(captain => {
        const distance = calculateDistance(lat, lng, captain.current_lat!, captain.current_lng!);
        const vehicle = captain.vehicles?.[0];
        return {
          id: captain.id,
          lat: captain.current_lat,
          lng: captain.current_lng,
          distance_km: Math.round(distance * 100) / 100,
          vehicle_type: vehicle?.vehicle_type || 'cab',
          rating: captain.rating,
          last_updated: captain.location_updated_at,
        };
      })
      .filter(captain => captain.distance_km <= radius_km)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 20); // Limit to 20 nearest captains

    console.log(`[get-nearby-captains] Returning ${nearbyCaptains.length} captains within ${radius_km}km`);

    return new Response(
      JSON.stringify({ captains: nearbyCaptains }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-nearby-captains] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
