import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Types
export type BookingStatus =
  | 'IDLE'
  | 'LOCATION_READY'
  | 'DESTINATION_SELECTED'
  | 'VEHICLE_OPTIONS_VISIBLE'
  | 'FARE_READY'
  | 'SEARCHING_CAPTAIN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type VehicleType = 'bike' | 'auto' | 'cab';

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface FareEstimate {
  distance_km: number;
  duration_mins: number;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  surge_multiplier: number;
  total_fare: number;
  discount: number;
  final_fare: number;
  promo_applied?: { code: string; discount_type: string; discount_value: number } | null;
  promo_error?: string | null;
}

export interface AllFares {
  bike: FareEstimate | null;
  auto: FareEstimate | null;
  cab: FareEstimate | null;
}

export interface Captain {
  id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  rating: number;
  vehicle: {
    make: string;
    model: string;
    registration_number: string;
  };
  eta_mins: number;
}

export interface BookingState {
  pickupLocation: Location | null;
  dropLocation: Location | null;
  vehicleType: VehicleType;
  distance: number | null;
  eta: number | null;
  fare: FareEstimate | null;
  allFares: AllFares;
  status: BookingStatus;
  rideId: string | null;
  captain: Captain | null;
  otp: string | null;
  promoCode: string | null;
  isLoadingFares: boolean;
  error: string | null;
}

// Actions
export type BookingAction =
  | { type: 'SET_PICKUP'; payload: Location }
  | { type: 'SET_DROP'; payload: Location }
  | { type: 'SET_VEHICLE_TYPE'; payload: VehicleType }
  | { type: 'SET_FARES_LOADING'; payload: boolean }
  | { type: 'SET_ALL_FARES'; payload: AllFares }
  | { type: 'SET_FARE'; payload: FareEstimate }
  | { type: 'SET_PROMO'; payload: string | null }
  | { type: 'SET_STATUS'; payload: BookingStatus }
  | { type: 'SET_RIDE_ID'; payload: string }
  | { type: 'SET_CAPTAIN'; payload: Captain }
  | { type: 'SET_OTP'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

// Initial State
const initialState: BookingState = {
  pickupLocation: null,
  dropLocation: null,
  vehicleType: 'bike',
  distance: null,
  eta: null,
  fare: null,
  allFares: { bike: null, auto: null, cab: null },
  status: 'IDLE',
  rideId: null,
  captain: null,
  otp: null,
  promoCode: null,
  isLoadingFares: false,
  error: null,
};

// Reducer
function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'SET_PICKUP':
      return {
        ...state,
        pickupLocation: action.payload,
        status: state.dropLocation ? 'DESTINATION_SELECTED' : 'LOCATION_READY',
        error: null,
      };

    case 'SET_DROP':
      return {
        ...state,
        dropLocation: action.payload,
        status: 'DESTINATION_SELECTED',
        error: null,
      };

    case 'SET_VEHICLE_TYPE':
      return {
        ...state,
        vehicleType: action.payload,
        fare: state.allFares[action.payload],
        status: state.allFares[action.payload] ? 'FARE_READY' : state.status,
      };

    case 'SET_FARES_LOADING':
      return {
        ...state,
        isLoadingFares: action.payload,
      };

    case 'SET_ALL_FARES':
      const selectedFare = action.payload[state.vehicleType];
      return {
        ...state,
        allFares: action.payload,
        fare: selectedFare,
        distance: selectedFare?.distance_km || state.distance,
        eta: selectedFare?.duration_mins || state.eta,
        status: selectedFare ? 'VEHICLE_OPTIONS_VISIBLE' : state.status,
        isLoadingFares: false,
      };

    case 'SET_FARE':
      return {
        ...state,
        fare: action.payload,
        distance: action.payload.distance_km,
        eta: action.payload.duration_mins,
        status: 'FARE_READY',
      };

    case 'SET_PROMO':
      return {
        ...state,
        promoCode: action.payload,
      };

    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload,
      };

    case 'SET_RIDE_ID':
      return {
        ...state,
        rideId: action.payload,
      };

    case 'SET_CAPTAIN':
      return {
        ...state,
        captain: action.payload,
        status: 'ASSIGNED',
      };

    case 'SET_OTP':
      return {
        ...state,
        otp: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Mock fare generator for fallback
const MOCK_FARE_CONFIG = {
  bike: { base: 20, perKm: 10, perMin: 1, minFare: 30 },
  auto: { base: 30, perKm: 12, perMin: 1.5, minFare: 40 },
  cab: { base: 50, perKm: 15, perMin: 2, minFare: 80 },
};

export const generateMockFare = (
  distance: number,
  duration: number,
  type: VehicleType
): FareEstimate => {
  const config = MOCK_FARE_CONFIG[type];
  const distanceFare = distance * config.perKm;
  const timeFare = duration * config.perMin;
  const totalFare = Math.max(config.base + distanceFare + timeFare, config.minFare);

  return {
    distance_km: Math.round(distance * 10) / 10,
    duration_mins: Math.round(duration),
    base_fare: config.base,
    distance_fare: Math.round(distanceFare),
    time_fare: Math.round(timeFare),
    surge_multiplier: 1,
    total_fare: Math.round(totalFare),
    discount: 0,
    final_fare: Math.round(totalFare),
    promo_applied: null,
    promo_error: null,
  };
};

// Haversine distance calculation
export const calculateDistance = (
  pickup: Location,
  drop: Location
): { distance: number; duration: number } => {
  const R = 6371; // Earth's radius in km
  const dLat = ((drop.lat - pickup.lat) * Math.PI) / 180;
  const dLng = ((drop.lng - pickup.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pickup.lat * Math.PI) / 180) *
      Math.cos((drop.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Estimate duration: ~30 km/h average in city
  const duration = (distance / 30) * 60;

  return { distance, duration };
};

// Context
interface BookingContextType {
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

// Provider
export const BookingProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(bookingReducer, initialState);

  return (
    <BookingContext.Provider value={{ state, dispatch }}>
      {children}
    </BookingContext.Provider>
  );
};

// Hook
export const useBooking = () => {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
