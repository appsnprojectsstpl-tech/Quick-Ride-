-- =============================================
-- PHASE 1: PRODUCTION RIDE-MATCHING DATABASE SCHEMA
-- =============================================

-- 1. RIDE OFFERS TABLE - Track offer history
CREATE TABLE public.ride_offers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    captain_id UUID NOT NULL REFERENCES public.captains(id) ON DELETE CASCADE,
    offer_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    response_status TEXT NOT NULL DEFAULT 'pending' CHECK (response_status IN ('pending', 'accepted', 'declined', 'expired')),
    responded_at TIMESTAMP WITH TIME ZONE,
    decline_reason TEXT,
    distance_to_pickup_km NUMERIC,
    eta_minutes INTEGER,
    estimated_earnings NUMERIC,
    offer_sequence INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. CAPTAIN METRICS TABLE - Store performance metrics
CREATE TABLE public.captain_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    captain_id UUID NOT NULL REFERENCES public.captains(id) ON DELETE CASCADE UNIQUE,
    acceptance_rate NUMERIC DEFAULT 100.00 CHECK (acceptance_rate >= 0 AND acceptance_rate <= 100),
    cancellation_rate NUMERIC DEFAULT 0.00 CHECK (cancellation_rate >= 0 AND cancellation_rate <= 100),
    total_offers_received INTEGER DEFAULT 0,
    total_offers_accepted INTEGER DEFAULT 0,
    total_offers_declined INTEGER DEFAULT 0,
    total_offers_expired INTEGER DEFAULT 0,
    avg_response_time_seconds NUMERIC DEFAULT 0,
    total_rides_completed INTEGER DEFAULT 0,
    total_rides_cancelled INTEGER DEFAULT 0,
    daily_cancellation_count INTEGER DEFAULT 0,
    daily_cancellation_reset_at DATE DEFAULT CURRENT_DATE,
    cooldown_until TIMESTAMP WITH TIME ZONE,
    earnings_today NUMERIC DEFAULT 0,
    earnings_this_week NUMERIC DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. MATCHING CONFIG TABLE - City-level configuration
CREATE TABLE public.matching_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    city TEXT NOT NULL UNIQUE,
    initial_radius_km NUMERIC NOT NULL DEFAULT 1.5,
    max_radius_km NUMERIC NOT NULL DEFAULT 5.0,
    radius_expansion_step_km NUMERIC NOT NULL DEFAULT 1.0,
    offer_timeout_seconds INTEGER NOT NULL DEFAULT 15,
    max_offers_per_ride INTEGER NOT NULL DEFAULT 5,
    max_retry_attempts INTEGER NOT NULL DEFAULT 3,
    score_weight_eta NUMERIC NOT NULL DEFAULT 0.40,
    score_weight_acceptance NUMERIC NOT NULL DEFAULT 0.25,
    score_weight_rating NUMERIC NOT NULL DEFAULT 0.20,
    score_weight_cancellation NUMERIC NOT NULL DEFAULT 0.15,
    captain_delay_threshold_minutes INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. CANCELLATION PENALTIES TABLE - Fee matrix and tracking
CREATE TABLE public.cancellation_penalties (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    city TEXT NOT NULL,
    cancelled_by TEXT NOT NULL CHECK (cancelled_by IN ('rider', 'captain')),
    ride_status TEXT NOT NULL,
    min_time_after_match_seconds INTEGER DEFAULT 0,
    max_time_after_match_seconds INTEGER,
    penalty_amount NUMERIC NOT NULL DEFAULT 0,
    penalty_type TEXT NOT NULL DEFAULT 'fee' CHECK (penalty_type IN ('fee', 'cooldown', 'warning')),
    cooldown_minutes INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. ADD NEW COLUMNS TO RIDES TABLE
ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS matching_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_radius_km NUMERIC DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS excluded_captain_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_offer_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reassignment_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancellation_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID;

-- 6. ENABLE RLS ON ALL NEW TABLES
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captain_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_penalties ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR RIDE_OFFERS
CREATE POLICY "Admins can manage all ride offers" ON public.ride_offers
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Captains can view their offers" ON public.ride_offers
FOR SELECT USING (captain_id IN (
    SELECT id FROM public.captains WHERE user_id = auth.uid()
));

CREATE POLICY "Riders can view offers for their rides" ON public.ride_offers
FOR SELECT USING (ride_id IN (
    SELECT id FROM public.rides WHERE rider_id = auth.uid()
));

-- 8. RLS POLICIES FOR CAPTAIN_METRICS
CREATE POLICY "Admins can manage all captain metrics" ON public.captain_metrics
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Captains can view their own metrics" ON public.captain_metrics
FOR SELECT USING (captain_id IN (
    SELECT id FROM public.captains WHERE user_id = auth.uid()
));

CREATE POLICY "Service can update captain metrics" ON public.captain_metrics
FOR UPDATE USING (captain_id IN (
    SELECT id FROM public.captains WHERE user_id = auth.uid()
));

-- 9. RLS POLICIES FOR MATCHING_CONFIG
CREATE POLICY "Admins can manage matching config" ON public.matching_config
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active matching config" ON public.matching_config
FOR SELECT USING (is_active = true);

-- 10. RLS POLICIES FOR CANCELLATION_PENALTIES
CREATE POLICY "Admins can manage cancellation penalties" ON public.cancellation_penalties
FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active penalties" ON public.cancellation_penalties
FOR SELECT USING (is_active = true);

-- 11. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_ride_offers_ride_id ON public.ride_offers(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_offers_captain_id ON public.ride_offers(captain_id);
CREATE INDEX IF NOT EXISTS idx_ride_offers_status ON public.ride_offers(response_status);
CREATE INDEX IF NOT EXISTS idx_captain_metrics_captain_id ON public.captain_metrics(captain_id);
CREATE INDEX IF NOT EXISTS idx_captain_metrics_acceptance ON public.captain_metrics(acceptance_rate DESC);
CREATE INDEX IF NOT EXISTS idx_rides_status_matching ON public.rides(status, current_radius_km);

-- 12. ENABLE REALTIME FOR RIDE_OFFERS
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;

-- 13. SEED DEFAULT MATCHING CONFIG
INSERT INTO public.matching_config (city, initial_radius_km, max_radius_km, offer_timeout_seconds, max_offers_per_ride)
VALUES 
    ('default', 1.5, 5.0, 15, 5),
    ('bangalore', 2.0, 6.0, 12, 5),
    ('mumbai', 1.5, 5.0, 15, 5),
    ('delhi', 2.0, 5.0, 15, 5)
ON CONFLICT (city) DO NOTHING;

-- 14. SEED DEFAULT CANCELLATION PENALTIES
INSERT INTO public.cancellation_penalties (city, cancelled_by, ride_status, min_time_after_match_seconds, max_time_after_match_seconds, penalty_amount, penalty_type)
VALUES
    ('default', 'rider', 'pending', 0, NULL, 0, 'fee'),
    ('default', 'rider', 'matched', 0, 120, 0, 'fee'),
    ('default', 'rider', 'matched', 120, 300, 15, 'fee'),
    ('default', 'rider', 'captain_arriving', 0, NULL, 25, 'fee'),
    ('default', 'rider', 'waiting_for_rider', 0, NULL, 25, 'fee'),
    ('default', 'captain', 'matched', 0, NULL, 0, 'warning'),
    ('default', 'captain', 'captain_arriving', 0, NULL, 0, 'cooldown')
ON CONFLICT DO NOTHING;

-- 15. FUNCTION TO UPDATE CAPTAIN METRICS
CREATE OR REPLACE FUNCTION public.update_captain_metrics_on_offer_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Reset daily count if new day
    UPDATE public.captain_metrics
    SET 
        daily_cancellation_count = CASE 
            WHEN daily_cancellation_reset_at < CURRENT_DATE THEN 0 
            ELSE daily_cancellation_count 
        END,
        daily_cancellation_reset_at = CURRENT_DATE
    WHERE captain_id = NEW.captain_id;

    -- Update metrics based on response
    IF NEW.response_status = 'accepted' THEN
        UPDATE public.captain_metrics
        SET 
            total_offers_accepted = total_offers_accepted + 1,
            acceptance_rate = (total_offers_accepted + 1)::NUMERIC / GREATEST(total_offers_received, 1) * 100,
            avg_response_time_seconds = (avg_response_time_seconds * total_offers_received + 
                EXTRACT(EPOCH FROM (NEW.responded_at - NEW.offer_sent_at))) / (total_offers_received + 1),
            updated_at = now()
        WHERE captain_id = NEW.captain_id;
    ELSIF NEW.response_status = 'declined' THEN
        UPDATE public.captain_metrics
        SET 
            total_offers_declined = total_offers_declined + 1,
            acceptance_rate = total_offers_accepted::NUMERIC / GREATEST(total_offers_received, 1) * 100,
            updated_at = now()
        WHERE captain_id = NEW.captain_id;
    ELSIF NEW.response_status = 'expired' THEN
        UPDATE public.captain_metrics
        SET 
            total_offers_expired = total_offers_expired + 1,
            acceptance_rate = total_offers_accepted::NUMERIC / GREATEST(total_offers_received, 1) * 100,
            updated_at = now()
        WHERE captain_id = NEW.captain_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 16. TRIGGER FOR OFFER RESPONSE
CREATE TRIGGER on_offer_response_update_metrics
AFTER UPDATE OF response_status ON public.ride_offers
FOR EACH ROW
WHEN (OLD.response_status = 'pending' AND NEW.response_status != 'pending')
EXECUTE FUNCTION public.update_captain_metrics_on_offer_response();

-- 17. FUNCTION TO INITIALIZE CAPTAIN METRICS
CREATE OR REPLACE FUNCTION public.initialize_captain_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.captain_metrics (captain_id)
    VALUES (NEW.id)
    ON CONFLICT (captain_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 18. TRIGGER TO AUTO-CREATE METRICS FOR NEW CAPTAINS
CREATE TRIGGER on_captain_create_metrics
AFTER INSERT ON public.captains
FOR EACH ROW
EXECUTE FUNCTION public.initialize_captain_metrics();