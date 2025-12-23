import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DirectionsRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const { origin, destination }: DirectionsRequest = await req.json();

    console.log('Fetching directions from', origin, 'to', destination);

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.append('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.append('destination', `${destination.lat},${destination.lng}`);
    url.searchParams.append('mode', 'driving');
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Directions API error:', data.status, data.error_message);
      return new Response(
        JSON.stringify({ error: data.status, message: data.error_message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    const result = {
      polyline: route.overview_polyline.points,
      distance: {
        text: leg.distance.text,
        value: leg.distance.value, // meters
      },
      duration: {
        text: leg.duration.text,
        value: leg.duration.value, // seconds
      },
      steps: leg.steps.map((step: any) => ({
        instruction: step.html_instructions,
        distance: step.distance.text,
        duration: step.duration.text,
      })),
    };

    console.log('Directions fetched successfully:', result.distance.text, result.duration.text);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching directions:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
