import { useCallback, useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import { useGoogleMapsApiKey } from '@/hooks/useGoogleMaps';
import { Skeleton } from '@/components/ui/skeleton';

interface MapMarker {
  lat: number;
  lng: number;
  title?: string;
  icon?: 'pickup' | 'drop' | 'captain' | 'default';
}

interface GoogleMapViewProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  polylinePath?: Array<{ lat: number; lng: number }>;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bangalore

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

const polylineOptions = {
  strokeColor: '#6366f1',
  strokeOpacity: 0.8,
  strokeWeight: 4,
};

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

const GoogleMapView = ({
  center = defaultCenter,
  zoom = 15,
  markers = [],
  polylinePath,
  onMapClick,
  className = 'h-full w-full',
}: GoogleMapViewProps) => {
  const { apiKey, isLoading, error } = useGoogleMapsApiKey();
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  // Fit bounds when polyline or markers change
  useEffect(() => {
    if (!map) return;

    if (polylinePath && polylinePath.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      polylinePath.forEach((point) => {
        bounds.extend(new google.maps.LatLng(point.lat, point.lng));
      });
      map.fitBounds(bounds, { top: 100, bottom: 300, left: 50, right: 50 });
    } else if (markers.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach((marker) => {
        bounds.extend(new google.maps.LatLng(marker.lat, marker.lng));
      });
      map.fitBounds(bounds, { top: 100, bottom: 300, left: 50, right: 50 });
    }
  }, [map, polylinePath, markers]);

  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (error || !apiKey) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted`}>
        <p className="text-muted-foreground text-sm">
          {error || 'Unable to load map'}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <LoadScript googleMapsApiKey={apiKey} libraries={['places']}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={zoom}
          options={mapOptions}
          onLoad={onLoad}
          onClick={(e) => {
            if (onMapClick && e.latLng) {
              onMapClick(e.latLng.lat(), e.latLng.lng());
            }
          }}
        >
          {/* Route Polyline */}
          {polylinePath && polylinePath.length > 1 && (
            <Polyline path={polylinePath} options={polylineOptions} />
          )}

          {/* Markers */}
          {markers.map((marker, index) => {
            const iconUrl = marker.icon === 'captain' 
              ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
              : marker.icon === 'pickup'
              ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
              : marker.icon === 'drop'
              ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
              : undefined;

            return (
              <Marker
                key={index}
                position={{ lat: marker.lat, lng: marker.lng }}
                title={marker.title}
                icon={iconUrl}
              />
            );
          })}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export { decodePolyline };
export default GoogleMapView;
