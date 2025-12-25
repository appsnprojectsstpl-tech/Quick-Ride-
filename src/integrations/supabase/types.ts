export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cancellation_penalties: {
        Row: {
          cancelled_by: string
          city: string
          cooldown_minutes: number | null
          created_at: string
          id: string
          is_active: boolean
          max_time_after_match_seconds: number | null
          min_time_after_match_seconds: number | null
          penalty_amount: number
          penalty_type: string
          ride_status: string
        }
        Insert: {
          cancelled_by: string
          city: string
          cooldown_minutes?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_time_after_match_seconds?: number | null
          min_time_after_match_seconds?: number | null
          penalty_amount?: number
          penalty_type?: string
          ride_status: string
        }
        Update: {
          cancelled_by?: string
          city?: string
          cooldown_minutes?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_time_after_match_seconds?: number | null
          min_time_after_match_seconds?: number | null
          penalty_amount?: number
          penalty_type?: string
          ride_status?: string
        }
        Relationships: []
      }
      captain_documents: {
        Row: {
          captain_id: string
          created_at: string
          document_type: string
          document_url: string
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["kyc_status"] | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          captain_id: string
          created_at?: string
          document_type: string
          document_url: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["kyc_status"] | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          captain_id?: string
          created_at?: string
          document_type?: string
          document_url?: string
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["kyc_status"] | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captain_documents_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_metrics: {
        Row: {
          acceptance_rate: number | null
          avg_response_time_seconds: number | null
          cancellation_rate: number | null
          captain_id: string
          cooldown_until: string | null
          daily_cancellation_count: number | null
          daily_cancellation_reset_at: string | null
          earnings_this_week: number | null
          earnings_today: number | null
          id: string
          total_offers_accepted: number | null
          total_offers_declined: number | null
          total_offers_expired: number | null
          total_offers_received: number | null
          total_rides_cancelled: number | null
          total_rides_completed: number | null
          updated_at: string
        }
        Insert: {
          acceptance_rate?: number | null
          avg_response_time_seconds?: number | null
          cancellation_rate?: number | null
          captain_id: string
          cooldown_until?: string | null
          daily_cancellation_count?: number | null
          daily_cancellation_reset_at?: string | null
          earnings_this_week?: number | null
          earnings_today?: number | null
          id?: string
          total_offers_accepted?: number | null
          total_offers_declined?: number | null
          total_offers_expired?: number | null
          total_offers_received?: number | null
          total_rides_cancelled?: number | null
          total_rides_completed?: number | null
          updated_at?: string
        }
        Update: {
          acceptance_rate?: number | null
          avg_response_time_seconds?: number | null
          cancellation_rate?: number | null
          captain_id?: string
          cooldown_until?: string | null
          daily_cancellation_count?: number | null
          daily_cancellation_reset_at?: string | null
          earnings_this_week?: number | null
          earnings_today?: number | null
          id?: string
          total_offers_accepted?: number | null
          total_offers_declined?: number | null
          total_offers_expired?: number | null
          total_offers_received?: number | null
          total_rides_cancelled?: number | null
          total_rides_completed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captain_metrics_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: true
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          captain_id: string
          created_at: string
          description: string | null
          id: string
          ride_id: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          captain_id: string
          created_at?: string
          description?: string | null
          id?: string
          ride_id?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          captain_id?: string
          created_at?: string
          description?: string | null
          id?: string
          ride_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "captain_transactions_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      captains: {
        Row: {
          created_at: string
          current_lat: number | null
          current_lng: number | null
          id: string
          is_verified: boolean | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          location_updated_at: string | null
          rating: number | null
          status: Database["public"]["Enums"]["captain_status"]
          total_earnings: number | null
          total_rides: number | null
          updated_at: string
          user_id: string
          wallet_balance: number | null
        }
        Insert: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          is_verified?: boolean | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          location_updated_at?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["captain_status"]
          total_earnings?: number | null
          total_rides?: number | null
          updated_at?: string
          user_id: string
          wallet_balance?: number | null
        }
        Update: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          is_verified?: boolean | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          location_updated_at?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["captain_status"]
          total_earnings?: number | null
          total_rides?: number | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number | null
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          created_at: string
          description: string | null
          emergency_contacts_notified: boolean | null
          id: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          location_lat: number | null
          location_lng: number | null
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          ride_id: string | null
          status: Database["public"]["Enums"]["incident_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          emergency_contacts_notified?: boolean | null
          id?: string
          incident_type: Database["public"]["Enums"]["incident_type"]
          location_lat?: number | null
          location_lng?: number | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          emergency_contacts_notified?: boolean | null
          id?: string
          incident_type?: Database["public"]["Enums"]["incident_type"]
          location_lat?: number | null
          location_lng?: number | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "incidents_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      matching_config: {
        Row: {
          captain_delay_threshold_minutes: number
          city: string
          created_at: string
          id: string
          initial_radius_km: number
          is_active: boolean
          max_offers_per_ride: number
          max_radius_km: number
          max_retry_attempts: number
          offer_timeout_seconds: number
          radius_expansion_step_km: number
          score_weight_acceptance: number
          score_weight_cancellation: number
          score_weight_eta: number
          score_weight_rating: number
          updated_at: string
        }
        Insert: {
          captain_delay_threshold_minutes?: number
          city: string
          created_at?: string
          id?: string
          initial_radius_km?: number
          is_active?: boolean
          max_offers_per_ride?: number
          max_radius_km?: number
          max_retry_attempts?: number
          offer_timeout_seconds?: number
          radius_expansion_step_km?: number
          score_weight_acceptance?: number
          score_weight_cancellation?: number
          score_weight_eta?: number
          score_weight_rating?: number
          updated_at?: string
        }
        Update: {
          captain_delay_threshold_minutes?: number
          city?: string
          created_at?: string
          id?: string
          initial_radius_km?: number
          is_active?: boolean
          max_offers_per_ride?: number
          max_radius_km?: number
          max_retry_attempts?: number
          offer_timeout_seconds?: number
          radius_expansion_step_km?: number
          score_weight_acceptance?: number
          score_weight_cancellation?: number
          score_weight_eta?: number
          score_weight_rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          base_fare: number
          city: string
          created_at: string
          id: string
          is_active: boolean | null
          max_surge_multiplier: number | null
          min_fare: number
          per_km_rate: number
          per_min_rate: number
          surge_threshold_demand: number | null
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          base_fare: number
          city: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_surge_multiplier?: number | null
          min_fare: number
          per_km_rate: number
          per_min_rate: number
          surge_threshold_demand?: number | null
          updated_at?: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          base_fare?: number
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_surge_multiplier?: number | null
          min_fare?: number
          per_km_rate?: number
          per_min_rate?: number
          surge_threshold_demand?: number | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          language: string | null
          name: string | null
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          language?: string | null
          name?: string | null
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          language?: string | null
          name?: string | null
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_discount: number | null
          min_ride_value: number | null
          usage_limit: number | null
          used_count: number | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_ride_value?: number | null
          usage_limit?: number | null
          used_count?: number | null
          valid_from: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_ride_value?: number | null
          usage_limit?: number | null
          used_count?: number | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          feedback: string | null
          from_user_id: string | null
          id: string
          rating: number
          ride_id: string
          tags: string[] | null
          tip_amount: number | null
          to_user_id: string | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          from_user_id?: string | null
          id?: string
          rating: number
          ride_id: string
          tags?: string[] | null
          tip_amount?: number | null
          to_user_id?: string | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          from_user_id?: string | null
          id?: string
          rating?: number
          ride_id?: string
          tags?: string[] | null
          tip_amount?: number | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_location_updates: {
        Row: {
          id: string
          lat: number
          lng: number
          recorded_at: string
          ride_id: string
        }
        Insert: {
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          ride_id: string
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_location_updates_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          captain_id: string
          created_at: string
          decline_reason: string | null
          distance_to_pickup_km: number | null
          estimated_earnings: number | null
          eta_minutes: number | null
          expires_at: string
          id: string
          offer_sent_at: string
          offer_sequence: number
          responded_at: string | null
          response_status: string
          ride_id: string
        }
        Insert: {
          captain_id: string
          created_at?: string
          decline_reason?: string | null
          distance_to_pickup_km?: number | null
          estimated_earnings?: number | null
          eta_minutes?: number | null
          expires_at: string
          id?: string
          offer_sent_at?: string
          offer_sequence?: number
          responded_at?: string | null
          response_status?: string
          ride_id: string
        }
        Update: {
          captain_id?: string
          created_at?: string
          decline_reason?: string | null
          distance_to_pickup_km?: number | null
          estimated_earnings?: number | null
          eta_minutes?: number | null
          expires_at?: string
          id?: string
          offer_sent_at?: string
          offer_sequence?: number
          responded_at?: string | null
          response_status?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_offers_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          actual_distance_km: number | null
          actual_duration_mins: number | null
          base_fare: number | null
          cancellation_fee: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_user_id: string | null
          captain_arrived_at: string | null
          captain_id: string | null
          completed_at: string | null
          current_radius_km: number | null
          discount: number | null
          distance_fare: number | null
          drop_address: string
          drop_lat: number
          drop_lng: number
          estimated_distance_km: number | null
          estimated_duration_mins: number | null
          excluded_captain_ids: string[] | null
          final_fare: number | null
          id: string
          last_offer_sent_at: string | null
          matched_at: string | null
          matching_attempts: number | null
          otp: string | null
          payment_method: string | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promo_code: string | null
          reassignment_count: number | null
          requested_at: string
          rider_id: string | null
          route_polyline: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
          surge_multiplier: number | null
          time_fare: number | null
          total_fare: number | null
          vehicle_id: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          actual_distance_km?: number | null
          actual_duration_mins?: number | null
          base_fare?: number | null
          cancellation_fee?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_user_id?: string | null
          captain_arrived_at?: string | null
          captain_id?: string | null
          completed_at?: string | null
          current_radius_km?: number | null
          discount?: number | null
          distance_fare?: number | null
          drop_address: string
          drop_lat: number
          drop_lng: number
          estimated_distance_km?: number | null
          estimated_duration_mins?: number | null
          excluded_captain_ids?: string[] | null
          final_fare?: number | null
          id?: string
          last_offer_sent_at?: string | null
          matched_at?: string | null
          matching_attempts?: number | null
          otp?: string | null
          payment_method?: string | null
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          promo_code?: string | null
          reassignment_count?: number | null
          requested_at?: string
          rider_id?: string | null
          route_polyline?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          surge_multiplier?: number | null
          time_fare?: number | null
          total_fare?: number | null
          vehicle_id?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          actual_distance_km?: number | null
          actual_duration_mins?: number | null
          base_fare?: number | null
          cancellation_fee?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_user_id?: string | null
          captain_arrived_at?: string | null
          captain_id?: string | null
          completed_at?: string | null
          current_radius_km?: number | null
          discount?: number | null
          distance_fare?: number | null
          drop_address?: string
          drop_lat?: number
          drop_lng?: number
          estimated_distance_km?: number | null
          estimated_duration_mins?: number | null
          excluded_captain_ids?: string[] | null
          final_fare?: number | null
          id?: string
          last_offer_sent_at?: string | null
          matched_at?: string | null
          matching_attempts?: number | null
          otp?: string | null
          payment_method?: string | null
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          promo_code?: string | null
          reassignment_count?: number | null
          requested_at?: string
          rider_id?: string | null
          route_polyline?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
          surge_multiplier?: number | null
          time_fare?: number | null
          total_fare?: number | null
          vehicle_id?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "rides_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_locations: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      trip_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          ride_id: string
          share_token: string
          shared_with_name: string | null
          shared_with_phone: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          ride_id: string
          share_token: string
          shared_with_name?: string | null
          shared_with_phone?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          ride_id?: string
          share_token?: string
          shared_with_name?: string | null
          shared_with_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_shares_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          captain_id: string
          color: string | null
          created_at: string
          id: string
          is_active: boolean | null
          make: string
          model: string
          registration_number: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          year: number | null
        }
        Insert: {
          captain_id: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          make: string
          model: string
          registration_number: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          year?: number | null
        }
        Update: {
          captain_id?: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          make?: string
          model?: string
          registration_number?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_user_to_captain: {
        Args: { target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "rider" | "captain"
      captain_status: "offline" | "online" | "on_ride"
      incident_status: "open" | "investigating" | "resolved" | "closed"
      incident_type: "sos" | "complaint" | "dispute" | "safety_concern"
      kyc_status: "pending" | "under_review" | "approved" | "rejected"
      ride_status:
        | "pending"
        | "matched"
        | "captain_arriving"
        | "waiting_for_rider"
        | "in_progress"
        | "completed"
        | "cancelled"
      vehicle_type: "bike" | "auto" | "cab"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "rider", "captain"],
      captain_status: ["offline", "online", "on_ride"],
      incident_status: ["open", "investigating", "resolved", "closed"],
      incident_type: ["sos", "complaint", "dispute", "safety_concern"],
      kyc_status: ["pending", "under_review", "approved", "rejected"],
      ride_status: [
        "pending",
        "matched",
        "captain_arriving",
        "waiting_for_rider",
        "in_progress",
        "completed",
        "cancelled",
      ],
      vehicle_type: ["bike", "auto", "cab"],
    },
  },
} as const
