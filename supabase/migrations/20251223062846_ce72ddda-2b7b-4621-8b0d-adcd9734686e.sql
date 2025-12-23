-- Create role enum for user types
CREATE TYPE public.app_role AS ENUM ('admin', 'rider', 'captain');

-- Create ride status enum
CREATE TYPE public.ride_status AS ENUM ('pending', 'matched', 'captain_arriving', 'waiting_for_rider', 'in_progress', 'completed', 'cancelled');

-- Create captain status enum
CREATE TYPE public.captain_status AS ENUM ('offline', 'online', 'on_ride');

-- Create kyc status enum
CREATE TYPE public.kyc_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');

-- Create vehicle type enum
CREATE TYPE public.vehicle_type AS ENUM ('bike', 'auto', 'cab');

-- Create incident type enum
CREATE TYPE public.incident_type AS ENUM ('sos', 'complaint', 'dispute', 'safety_concern');

-- Create incident status enum
CREATE TYPE public.incident_status AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- User roles table (separate from profile for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- Profiles table for basic user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Emergency contacts for riders
CREATE TABLE public.emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    relationship TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Saved locations for riders
CREATE TABLE public.saved_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Captains table (extends profile with captain-specific info)
CREATE TABLE public.captains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    status captain_status DEFAULT 'offline' NOT NULL,
    kyc_status kyc_status DEFAULT 'pending' NOT NULL,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    location_updated_at TIMESTAMP WITH TIME ZONE,
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0,
    wallet_balance DECIMAL(12,2) DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Vehicles table
CREATE TABLE public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID REFERENCES public.captains(id) ON DELETE CASCADE NOT NULL,
    vehicle_type vehicle_type NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    registration_number TEXT NOT NULL UNIQUE,
    color TEXT,
    year INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Captain documents for KYC
CREATE TABLE public.captain_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID REFERENCES public.captains(id) ON DELETE CASCADE NOT NULL,
    document_type TEXT NOT NULL,
    document_url TEXT NOT NULL,
    status kyc_status DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Rides table
CREATE TABLE public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    captain_id UUID REFERENCES public.captains(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    status ride_status DEFAULT 'pending' NOT NULL,
    vehicle_type vehicle_type NOT NULL,
    
    -- Pickup details
    pickup_address TEXT NOT NULL,
    pickup_lat DOUBLE PRECISION NOT NULL,
    pickup_lng DOUBLE PRECISION NOT NULL,
    
    -- Drop details
    drop_address TEXT NOT NULL,
    drop_lat DOUBLE PRECISION NOT NULL,
    drop_lng DOUBLE PRECISION NOT NULL,
    
    -- Fare details
    estimated_distance_km DECIMAL(10,2),
    estimated_duration_mins INTEGER,
    base_fare DECIMAL(10,2),
    distance_fare DECIMAL(10,2),
    time_fare DECIMAL(10,2),
    surge_multiplier DECIMAL(3,2) DEFAULT 1.00,
    total_fare DECIMAL(10,2),
    promo_code TEXT,
    discount DECIMAL(10,2) DEFAULT 0,
    final_fare DECIMAL(10,2),
    payment_method TEXT DEFAULT 'cash',
    
    -- OTP for ride verification
    otp TEXT,
    
    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    matched_at TIMESTAMP WITH TIME ZONE,
    captain_arrived_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    cancelled_by TEXT,
    
    -- Route tracking
    route_polyline TEXT,
    actual_distance_km DECIMAL(10,2),
    actual_duration_mins INTEGER
);

-- Ride location updates for tracking
CREATE TABLE public.ride_location_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Ratings table
CREATE TABLE public.ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    tags TEXT[],
    tip_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Safety incidents
CREATE TABLE public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    incident_type incident_type NOT NULL,
    status incident_status DEFAULT 'open' NOT NULL,
    description TEXT,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    emergency_contacts_notified BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Pricing configuration
CREATE TABLE public.pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city TEXT NOT NULL,
    vehicle_type vehicle_type NOT NULL,
    base_fare DECIMAL(10,2) NOT NULL,
    per_km_rate DECIMAL(10,2) NOT NULL,
    per_min_rate DECIMAL(10,2) NOT NULL,
    min_fare DECIMAL(10,2) NOT NULL,
    surge_threshold_demand DECIMAL(3,2) DEFAULT 1.5,
    max_surge_multiplier DECIMAL(3,2) DEFAULT 3.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (city, vehicle_type)
);

-- Promo codes
CREATE TABLE public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
    discount_value DECIMAL(10,2) NOT NULL,
    max_discount DECIMAL(10,2),
    min_ride_value DECIMAL(10,2) DEFAULT 0,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Captain earnings transactions
CREATE TABLE public.captain_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID REFERENCES public.captains(id) ON DELETE CASCADE NOT NULL,
    ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('ride_earning', 'bonus', 'incentive', 'payout', 'deduction')),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    balance_after DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Trip sharing links
CREATE TABLE public.trip_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    shared_with_phone TEXT,
    shared_with_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captain_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_location_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captain_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_shares ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for emergency_contacts
CREATE POLICY "Users can manage their emergency contacts"
ON public.emergency_contacts FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policies for saved_locations
CREATE POLICY "Users can manage their saved locations"
ON public.saved_locations FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policies for captains
CREATE POLICY "Captains can view and update their own record"
ON public.captains FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Riders can view online captains"
ON public.captains FOR SELECT
TO authenticated
USING (status = 'online' AND is_verified = TRUE);

CREATE POLICY "Admins can manage all captains"
ON public.captains FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for vehicles
CREATE POLICY "Captains can manage their vehicles"
ON public.vehicles FOR ALL
TO authenticated
USING (
    captain_id IN (SELECT id FROM public.captains WHERE user_id = auth.uid())
);

CREATE POLICY "Riders can view vehicles"
ON public.vehicles FOR SELECT
TO authenticated
USING (TRUE);

CREATE POLICY "Admins can manage all vehicles"
ON public.vehicles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for captain_documents
CREATE POLICY "Captains can manage their documents"
ON public.captain_documents FOR ALL
TO authenticated
USING (
    captain_id IN (SELECT id FROM public.captains WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage all documents"
ON public.captain_documents FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for rides
CREATE POLICY "Riders can view their rides"
ON public.rides FOR SELECT
TO authenticated
USING (rider_id = auth.uid());

CREATE POLICY "Captains can view their rides"
ON public.rides FOR SELECT
TO authenticated
USING (
    captain_id IN (SELECT id FROM public.captains WHERE user_id = auth.uid())
);

CREATE POLICY "Riders can create rides"
ON public.rides FOR INSERT
TO authenticated
WITH CHECK (rider_id = auth.uid());

CREATE POLICY "Riders and captains can update their rides"
ON public.rides FOR UPDATE
TO authenticated
USING (
    rider_id = auth.uid() OR
    captain_id IN (SELECT id FROM public.captains WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage all rides"
ON public.rides FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for ride_location_updates
CREATE POLICY "Ride participants can view location updates"
ON public.ride_location_updates FOR SELECT
TO authenticated
USING (
    ride_id IN (
        SELECT id FROM public.rides 
        WHERE rider_id = auth.uid() 
        OR captain_id IN (SELECT id FROM public.captains WHERE user_id = auth.uid())
    )
);

CREATE POLICY "Captains can insert location updates"
ON public.ride_location_updates FOR INSERT
TO authenticated
WITH CHECK (
    ride_id IN (
        SELECT id FROM public.rides 
        WHERE captain_id IN (SELECT id FROM public.captains WHERE user_id = auth.uid())
    )
);

-- RLS Policies for ratings
CREATE POLICY "Users can create ratings for their rides"
ON public.ratings FOR INSERT
TO authenticated
WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can view their ratings"
ON public.ratings FOR SELECT
TO authenticated
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Admins can view all ratings"
ON public.ratings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for incidents
CREATE POLICY "Users can create incidents"
ON public.incidents FOR INSERT
TO authenticated
WITH CHECK (reported_by = auth.uid());

CREATE POLICY "Users can view their incidents"
ON public.incidents FOR SELECT
TO authenticated
USING (reported_by = auth.uid());

CREATE POLICY "Admins can manage all incidents"
ON public.incidents FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for pricing_config (public read, admin write)
CREATE POLICY "Anyone can view pricing"
ON public.pricing_config FOR SELECT
TO authenticated
USING (is_active = TRUE);

CREATE POLICY "Admins can manage pricing"
ON public.pricing_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for promo_codes
CREATE POLICY "Anyone can view active promos"
ON public.promo_codes FOR SELECT
TO authenticated
USING (is_active = TRUE);

CREATE POLICY "Admins can manage promos"
ON public.promo_codes FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for captain_transactions
CREATE POLICY "Captains can view their transactions"
ON public.captain_transactions FOR SELECT
TO authenticated
USING (
    captain_id IN (SELECT id FROM public.captains WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage transactions"
ON public.captain_transactions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for trip_shares (public access for shared links)
CREATE POLICY "Anyone can view active shares"
ON public.trip_shares FOR SELECT
USING (is_active = TRUE);

CREATE POLICY "Riders can create shares for their rides"
ON public.trip_shares FOR INSERT
TO authenticated
WITH CHECK (
    ride_id IN (SELECT id FROM public.rides WHERE rider_id = auth.uid())
);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, phone, name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        NEW.email
    );
    RETURN NEW;
END;
$$;

-- Trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_captains_updated_at
    BEFORE UPDATE ON public.captains
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_captain_documents_updated_at
    BEFORE UPDATE ON public.captain_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_config_updated_at
    BEFORE UPDATE ON public.pricing_config
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.captains;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_location_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;

-- Insert default pricing for Delhi
INSERT INTO public.pricing_config (city, vehicle_type, base_fare, per_km_rate, per_min_rate, min_fare)
VALUES 
    ('delhi', 'bike', 15.00, 5.00, 1.00, 25.00),
    ('delhi', 'auto', 25.00, 8.00, 1.50, 40.00),
    ('delhi', 'cab', 50.00, 12.00, 2.00, 80.00);