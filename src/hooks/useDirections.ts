import { useState, useCallback, useEffect, useRef } from 'react';
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
  durationInTraffic: {
    text: string;
    value: number;
  };
  eta: string; // ISO timestamp
  decodedPath: Array<{ lat: number; lng: number }>;
  steps: NavigationStep[];
}

interface UseDirectionsOptions {
  autoRefreshInterval?: number; // in milliseconds, default 30000 (30 seconds)
  enabled?: boolean;
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
  lastUpdated: Date | null;
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

// Calculate distance between two points in meters
const getDistanceInMeters = (
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const useDirections = (options: UseDirectionsOptions = {}): UseDirectionsResult => {
  const { autoRefreshInterval = 30000, enabled = true } = options;
  
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const lastOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastDestinationRef = useRef<{ lat: number; lng: number } | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDirections = useCallback(
    async (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number }
    ) => {
      // Store for auto-refresh
      lastOriginRef.current = origin;
      lastDestinationRef.current = destination;
      
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
          durationInTraffic: data.duration_in_traffic || data.duration,
          eta: data.eta || new Date(Date.now() + (data.duration_in_traffic?.value || data.duration.value) * 1000).toISOString(),
          decodedPath,
          steps,
        });
        
        setLastUpdated(new Date());
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

  // Auto-refresh directions at specified interval
  useEffect(() => {
    if (!enabled || !autoRefreshInterval) {
      return;
    }

    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    refreshIntervalRef.current = setInterval(() => {
      if (lastOriginRef.current && lastDestinationRef.current) {
        // Only refresh if we have valid coordinates
        fetchDirections(lastOriginRef.current, lastDestinationRef.current);
      }
    }, autoRefreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [enabled, autoRefreshInterval, fetchDirections]);

  const clearRoute = useCallback(() => {
    setRouteInfo(null);
    setError(null);
    setLastUpdated(null);
    lastOriginRef.current = null;
    lastDestinationRef.current = null;
    
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
  }, []);

  return { routeInfo, isLoading, error, fetchDirections, clearRoute, lastUpdated };
};

export { getDistanceInMeters };
