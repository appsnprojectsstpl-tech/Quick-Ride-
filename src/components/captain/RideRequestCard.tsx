import { useState, useEffect } from 'react';
import { MapPin, Clock, IndianRupee, Check, X, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface RideRequest {
  id: string;
  pickup_address: string;
  drop_address: string;
  estimated_distance_km: number;
  estimated_duration_mins: number;
  final_fare: number;
  vehicle_type: string;
  pickup_lat: number;
  pickup_lng: number;
}

interface RideRequestCardProps {
  request: RideRequest;
  distanceToPickup: number;
  onAccept: () => void;
  onDecline: () => void;
  timeRemaining: number;
}

const RideRequestCard = ({ 
  request, 
  distanceToPickup, 
  onAccept, 
  onDecline,
  timeRemaining 
}: RideRequestCardProps) => {
  const captainEarning = Math.round((request.final_fare || 0) * 0.8); // 80% goes to captain

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-24 left-4 right-4 z-50"
    >
      <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Timer Bar */}
        <div className="h-1 bg-muted">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 30, ease: 'linear' }}
            className="h-full bg-primary"
          />
        </div>

        {/* Header */}
        <div className="p-4 bg-primary/10 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-primary" />
              <span className="font-semibold">New Ride Request</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">₹{captainEarning}</p>
              <p className="text-xs text-muted-foreground">Your earning</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Distance & Time to Pickup */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{distanceToPickup.toFixed(1)} km away</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>~{Math.round(distanceToPickup * 3)} min</span>
            </div>
          </div>

          {/* Route */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-success mt-1" />
              <div>
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium line-clamp-1">{request.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-destructive mt-1" />
              <div>
                <p className="text-xs text-muted-foreground">Drop</p>
                <p className="text-sm font-medium line-clamp-1">{request.drop_address}</p>
              </div>
            </div>
          </div>

          {/* Trip Details */}
          <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
            <div className="text-center">
              <p className="text-muted-foreground">Distance</p>
              <p className="font-semibold">{request.estimated_distance_km} km</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Duration</p>
              <p className="font-semibold">{request.estimated_duration_mins} min</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Type</p>
              <p className="font-semibold capitalize">{request.vehicle_type}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex border-t border-border">
          <Button
            variant="ghost"
            className="flex-1 rounded-none h-14 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDecline}
          >
            <X className="w-5 h-5 mr-2" />
            Decline
          </Button>
          <Button
            className="flex-1 rounded-none h-14"
            onClick={onAccept}
          >
            <Check className="w-5 h-5 mr-2" />
            Accept
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default RideRequestCard;
