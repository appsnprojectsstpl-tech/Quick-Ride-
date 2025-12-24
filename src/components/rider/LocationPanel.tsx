import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Home, Briefcase, Star, Crosshair, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBooking, Location } from '@/contexts/BookingContext';
import { useToast } from '@/hooks/use-toast';

interface LocationPanelProps {
  onPickupSelect?: (location: Location) => void;
  onDropSelect?: (location: Location) => void;
}

const LocationPanel = ({ onPickupSelect, onDropSelect }: LocationPanelProps) => {
  const { state, dispatch } = useBooking();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropQuery, setDropQuery] = useState('');
  const [pickupSuggestions, setPickupSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<'pickup' | 'drop' | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  // Initialize Google services
  useEffect(() => {
    const initServices = () => {
      if (window.google?.maps) {
        autocompleteService.current = new google.maps.places.AutocompleteService();
        const mapDiv = document.createElement('div');
        placesService.current = new google.maps.places.PlacesService(mapDiv);
        geocoder.current = new google.maps.Geocoder();
      }
    };
    
    if (window.google?.maps) {
      initServices();
    } else {
      // Wait for Google Maps to load
      const interval = setInterval(() => {
        if (window.google?.maps) {
          initServices();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  // Fetch saved locations
  useEffect(() => {
    if (user) {
      fetchSavedLocations();
    }
  }, [user]);

  // Auto-fill pickup from GPS on mount
  useEffect(() => {
    if (!state.pickupLocation && navigator.geolocation) {
      getCurrentLocation();
    }
  }, []);

  const fetchSavedLocations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_locations')
      .select('*')
      .eq('user_id', user.id)
      .limit(5);
    setSavedLocations(data || []);
  };

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Reverse geocode to get address
        if (geocoder.current) {
          geocoder.current.geocode(
            { location: { lat, lng } },
            (results, status) => {
              if (status === 'OK' && results?.[0]) {
                const location: Location = {
                  lat,
                  lng,
                  address: results[0].formatted_address,
                };
                setPickupQuery(location.address);
                dispatch({ type: 'SET_PICKUP', payload: location });
                onPickupSelect?.(location);
              } else {
                // Fallback without address
                const location: Location = {
                  lat,
                  lng,
                  address: 'Current Location',
                };
                setPickupQuery('Current Location');
                dispatch({ type: 'SET_PICKUP', payload: location });
                onPickupSelect?.(location);
              }
              setIsGettingLocation(false);
            }
          );
        } else {
          const location: Location = {
            lat,
            lng,
            address: 'Current Location',
          };
          setPickupQuery('Current Location');
          dispatch({ type: 'SET_PICKUP', payload: location });
          onPickupSelect?.(location);
          setIsGettingLocation(false);
        }
      },
      (error) => {
        console.error('Location error:', error);
        toast({
          variant: 'destructive',
          title: 'Location access denied',
          description: 'Please enter your pickup location manually.',
        });
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearch = (value: string, type: 'pickup' | 'drop') => {
    if (type === 'pickup') {
      setPickupQuery(value);
    } else {
      setDropQuery(value);
    }
    
    if (value.length < 2) {
      if (type === 'pickup') setPickupSuggestions([]);
      else setDropSuggestions([]);
      return;
    }

    if (autocompleteService.current) {
      autocompleteService.current.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: 'in' },
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            if (type === 'pickup') setPickupSuggestions(predictions);
            else setDropSuggestions(predictions);
          }
        }
      );
    }
  };

  const handleSelectPlace = (placeId: string, description: string, type: 'pickup' | 'drop') => {
    if (placesService.current) {
      placesService.current.getDetails(
        { placeId, fields: ['geometry', 'formatted_address'] },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const location: Location = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              address: place.formatted_address || description,
            };

            if (type === 'pickup') {
              setPickupQuery(location.address);
              setPickupSuggestions([]);
              dispatch({ type: 'SET_PICKUP', payload: location });
              onPickupSelect?.(location);
            } else {
              setDropQuery(location.address);
              setDropSuggestions([]);
              dispatch({ type: 'SET_DROP', payload: location });
              onDropSelect?.(location);
            }
            setActiveInput(null);
          }
        }
      );
    }
  };

  const handleSelectSaved = (saved: any, type: 'pickup' | 'drop') => {
    const location: Location = {
      lat: saved.lat,
      lng: saved.lng,
      address: saved.address,
    };
    
    if (type === 'pickup') {
      setPickupQuery(saved.address);
      dispatch({ type: 'SET_PICKUP', payload: location });
      onPickupSelect?.(location);
    } else {
      setDropQuery(saved.address);
      dispatch({ type: 'SET_DROP', payload: location });
      onDropSelect?.(location);
    }
    setActiveInput(null);
  };

  const getIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home':
        return <Home className="w-4 h-4" />;
      case 'work':
        return <Briefcase className="w-4 h-4" />;
      default:
        return <Star className="w-4 h-4" />;
    }
  };

  const renderSuggestions = (
    suggestions: google.maps.places.AutocompletePrediction[],
    type: 'pickup' | 'drop'
  ) => {
    const query = type === 'pickup' ? pickupQuery : dropQuery;
    const showSaved = query.length === 0 && savedLocations.length > 0;

    if (!showSaved && suggestions.length === 0) return null;

    return (
      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
        {/* Saved Locations */}
        {showSaved && (
          <div className="p-2 border-b border-border">
            <p className="text-xs text-muted-foreground px-2 py-1">Saved Places</p>
            {savedLocations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleSelectSaved(loc, type)}
                className="w-full flex items-center gap-3 px-2 py-2 hover:bg-muted rounded-lg transition-colors"
              >
                <span className="text-primary">{getIcon(loc.label)}</span>
                <div className="text-left">
                  <p className="text-sm font-medium">{loc.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{loc.address}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Search Suggestions */}
        {suggestions.length > 0 && (
          <div className="p-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.place_id}
                onClick={() => handleSelectPlace(suggestion.place_id, suggestion.description, type)}
                className="w-full flex items-center gap-3 px-2 py-2 hover:bg-muted rounded-lg transition-colors"
              >
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm">{suggestion.structured_formatting.main_text}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {suggestion.structured_formatting.secondary_text}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-lg border border-border space-y-3">
      {/* Pickup Input */}
      <div className="relative">
        <div className="relative flex items-center gap-2">
          <div className="absolute left-3 w-3 h-3 rounded-full bg-green-500" />
          <Input
            value={pickupQuery}
            onChange={(e) => handleSearch(e.target.value, 'pickup')}
            onFocus={() => setActiveInput('pickup')}
            placeholder={isGettingLocation ? 'Getting location...' : 'Pickup location'}
            className="pl-8 pr-10"
            disabled={isGettingLocation}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={getCurrentLocation}
            disabled={isGettingLocation}
          >
            {isGettingLocation ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Crosshair className="w-4 h-4" />
            )}
          </Button>
        </div>
        {activeInput === 'pickup' && renderSuggestions(pickupSuggestions, 'pickup')}
      </div>

      {/* Dotted line connector */}
      <div className="flex items-center pl-[18px]">
        <div className="w-0.5 h-4 border-l-2 border-dashed border-muted-foreground/30" />
      </div>

      {/* Drop Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-3 w-3 h-3 rounded-full bg-red-500" />
          <Input
            value={dropQuery}
            onChange={(e) => handleSearch(e.target.value, 'drop')}
            onFocus={() => setActiveInput('drop')}
            placeholder="Where to?"
            className="pl-8 pr-10"
          />
          <Search className="absolute right-3 w-4 h-4 text-muted-foreground" />
        </div>
        {activeInput === 'drop' && renderSuggestions(dropSuggestions, 'drop')}
      </div>

      {/* Helper text */}
      {!state.pickupLocation && !state.dropLocation && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Enter pickup and drop-off to find rides
        </p>
      )}
    </div>
  );
};

export default LocationPanel;
