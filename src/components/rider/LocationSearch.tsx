import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Home, Briefcase, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Location {
  lat: number;
  lng: number;
  address: string;
  label?: string;
}

interface LocationSearchProps {
  placeholder: string;
  onSelect: (location: Location) => void;
  icon?: 'pickup' | 'drop';
}

const LocationSearch = ({ placeholder, onSelect, icon = 'pickup' }: LocationSearchProps) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  useEffect(() => {
    if (window.google) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      const mapDiv = document.createElement('div');
      placesService.current = new google.maps.places.PlacesService(mapDiv);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSavedLocations();
    }
  }, [user]);

  const fetchSavedLocations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_locations')
      .select('*')
      .eq('user_id', user.id)
      .limit(5);
    setSavedLocations(data || []);
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length < 3) {
      setSuggestions([]);
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
            setSuggestions(predictions);
          }
        }
      );
    }
  };

  const handleSelectPlace = (placeId: string, description: string) => {
    if (placesService.current) {
      placesService.current.getDetails(
        { placeId, fields: ['geometry', 'formatted_address'] },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            onSelect({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              address: place.formatted_address || description,
            });
            setQuery(place.formatted_address || description);
            setIsOpen(false);
            setSuggestions([]);
          }
        }
      );
    }
  };

  const handleSelectSaved = (location: any) => {
    onSelect({
      lat: location.lat,
      lng: location.lng,
      address: location.address,
      label: location.label,
    });
    setQuery(location.address);
    setIsOpen(false);
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

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <div className={`absolute left-3 w-3 h-3 rounded-full ${
          icon === 'pickup' ? 'bg-success' : 'bg-destructive'
        }`} />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-8 pr-10"
        />
        <Search className="absolute right-3 w-4 h-4 text-muted-foreground" />
      </div>

      {isOpen && (query.length > 0 || savedLocations.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Saved Locations */}
          {query.length === 0 && savedLocations.length > 0 && (
            <div className="p-2 border-b border-border">
              <p className="text-xs text-muted-foreground px-2 py-1">Saved Places</p>
              {savedLocations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleSelectSaved(loc)}
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
                  onClick={() => handleSelectPlace(suggestion.place_id, suggestion.description)}
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
      )}
    </div>
  );
};

export default LocationSearch;
