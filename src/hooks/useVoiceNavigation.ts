import { useCallback, useRef, useEffect, useState } from 'react';

interface NavigationStep {
  instruction: string;
  distance: { text: string; value: number };
  maneuver: string;
}

interface UseVoiceNavigationOptions {
  enabled?: boolean;
  volume?: number;
  rate?: number;
  pitch?: number;
  language?: string;
}

export const useVoiceNavigation = (options: UseVoiceNavigationOptions = {}) => {
  const {
    enabled = true,
    volume = 1,
    rate = 0.9,
    pitch = 1,
    language = 'en-IN',
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(enabled);
  const lastSpokenRef = useRef<string>('');
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      speechSynthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string, force = false) => {
    if (!isSupported || !voiceEnabled || !speechSynthRef.current) return;
    
    // Avoid repeating the same instruction
    if (!force && text === lastSpokenRef.current) return;
    
    // Cancel any ongoing speech
    speechSynthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = language;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    speechSynthRef.current.speak(utterance);
    lastSpokenRef.current = text;
  }, [isSupported, voiceEnabled, volume, rate, pitch, language]);

  const announceStep = useCallback((step: NavigationStep) => {
    if (!step) return;
    
    // Clean up HTML tags from Google's instructions
    const cleanInstruction = step.instruction
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    speak(cleanInstruction);
  }, [speak]);

  const announceArrival = useCallback((destination: string) => {
    speak(`You have arrived at ${destination}`, true);
  }, [speak]);

  const announceRideStart = useCallback((pickup: string) => {
    speak(`Heading to pickup location: ${pickup}`, true);
  }, [speak]);

  const announcePickupArrival = useCallback(() => {
    speak('You have arrived at the pickup location. Please wait for the rider.', true);
  }, [speak]);

  const announceRideInProgress = useCallback((dropoff: string) => {
    speak(`Ride started. Heading to destination: ${dropoff}`, true);
  }, [speak]);

  const announceUpcomingTurn = useCallback((step: NavigationStep, distanceRemaining: number) => {
    // Announce when within 200m of next turn
    if (distanceRemaining <= 200 && distanceRemaining > 50) {
      const cleanInstruction = step.instruction.replace(/<[^>]*>/g, '').trim();
      speak(`In ${step.distance.text}, ${cleanInstruction}`);
    } else if (distanceRemaining <= 50) {
      const action = step.maneuver.includes('left') ? 'Turn left now' :
                    step.maneuver.includes('right') ? 'Turn right now' :
                    step.maneuver.includes('straight') ? 'Continue straight' : '';
      if (action) speak(action, true);
    }
  }, [speak]);

  const stop = useCallback(() => {
    if (speechSynthRef.current) {
      speechSynthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => !prev);
    if (voiceEnabled) {
      stop();
    }
  }, [voiceEnabled, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechSynthRef.current) {
        speechSynthRef.current.cancel();
      }
    };
  }, []);

  return {
    isSupported,
    isSpeaking,
    voiceEnabled,
    speak,
    announceStep,
    announceArrival,
    announceRideStart,
    announcePickupArrival,
    announceRideInProgress,
    announceUpcomingTurn,
    stop,
    toggleVoice,
  };
};
