import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NavigationStep {
  instruction: string;
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  maneuver: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
}

interface RouteInfo {
  polyline: string;
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  decodedPath: Array<{ lat: number; lng: number }>;
  steps: NavigationStep[];
}

interface UseDirectionsResult {
  routeInfo: RouteInfo | null;
  isLoading: boolean;
  error: string | null;
  fetchDirections: (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) => Promise<void>;
  clearRoute: () => void;
}

// Decode Google's encoded polyline format
const decodePolyline = (encoded: string): Array<{ lat: number; lng: number }> => {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
};

export const useDirections = (): UseDirectionsResult => {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirections = useCallback(
    async (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number }
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-directions', {
          body: { origin, destination },
        });

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data.error) {
          throw new Error(data.error);
        }

        const decodedPath = decodePolyline(data.polyline);

        // Parse steps from the response
        const steps: NavigationStep[] = (data.steps || []).map((step: any) => ({
          instruction: step.instruction?.replace(/<[^>]*>/g, '') || '',
          distance: step.distance || { text: '', value: 0 },
          duration: step.duration || { text: '', value: 0 },
          maneuver: step.maneuver || 'straight',
          startLocation: step.start_location || { lat: 0, lng: 0 },
          endLocation: step.end_location || { lat: 0, lng: 0 },
        }));

        setRouteInfo({
          polyline: data.polyline,
          distance: data.distance,
          duration: data.duration,
          decodedPath,
          steps,
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch directions';
        console.error('Directions error:', errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearRoute = useCallback(() => {
    setRouteInfo(null);
    setError(null);
  }, []);

  return { routeInfo, isLoading, error, fetchDirections, clearRoute };
};
