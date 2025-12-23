import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { useGoogleMapsApiKey } from '@/hooks/useGoogleMaps';
import { Skeleton } from '@/components/ui/skeleton';

interface GoogleMapViewProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: Array<{ lat: number; lng: number; title?: string }>;
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

const GoogleMapView = ({
  center = defaultCenter,
  zoom = 15,
  markers = [],
  onMapClick,
  className = 'h-full w-full',
}: GoogleMapViewProps) => {
  const { apiKey, isLoading, error } = useGoogleMapsApiKey();

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
          onClick={(e) => {
            if (onMapClick && e.latLng) {
              onMapClick(e.latLng.lat(), e.latLng.lng());
            }
          }}
        >
          {markers.map((marker, index) => (
            <Marker
              key={index}
              position={{ lat: marker.lat, lng: marker.lng }}
              title={marker.title}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default GoogleMapView;
