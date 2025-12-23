import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  ArrowUp, 
  ArrowLeft, 
  ArrowRight, 
  CornerUpLeft, 
  CornerUpRight,
  GitMerge,
  GitFork,
  RotateCcw,
  MapPin,
  Navigation
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavigationStep {
  instruction: string;
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  maneuver: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
}

interface NavigationInstructionsProps {
  steps: NavigationStep[];
  totalDistance: string;
  totalDuration: string;
  durationInTraffic?: string;
  eta?: string;
  destination: string;
  lastUpdated?: Date | null;
}

const getManeuverIcon = (maneuver: string) => {
  const iconClass = "w-6 h-6";
  
  if (maneuver.includes('left') && maneuver.includes('turn')) {
    return <ArrowLeft className={iconClass} />;
  }
  if (maneuver.includes('right') && maneuver.includes('turn')) {
    return <ArrowRight className={iconClass} />;
  }
  if (maneuver.includes('slight-left') || maneuver.includes('keep-left')) {
    return <CornerUpLeft className={iconClass} />;
  }
  if (maneuver.includes('slight-right') || maneuver.includes('keep-right')) {
    return <CornerUpRight className={iconClass} />;
  }
  if (maneuver.includes('merge')) {
    return <GitMerge className={iconClass} />;
  }
  if (maneuver.includes('fork')) {
    return <GitFork className={iconClass} />;
  }
  if (maneuver.includes('uturn') || maneuver.includes('u-turn')) {
    return <RotateCcw className={iconClass} />;
  }
  if (maneuver.includes('destination') || maneuver.includes('arrive')) {
    return <MapPin className={iconClass} />;
  }
  
  return <ArrowUp className={iconClass} />;
};

const NavigationInstructions = ({
  steps,
  totalDistance,
  totalDuration,
  durationInTraffic,
  eta,
  destination,
  lastUpdated,
}: NavigationInstructionsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!steps || steps.length === 0) {
    return null;
  }

  const currentStep = steps[0];
  const upcomingSteps = steps.slice(1);
  
  // Format ETA time
  const formatEta = (etaString?: string) => {
    if (!etaString) return null;
    const etaDate = new Date(etaString);
    return etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formattedEta = formatEta(eta);
  const displayDuration = durationInTraffic || totalDuration;

  return (
    <div className="bg-card rounded-xl border border-border shadow-lg overflow-hidden">
      {/* ETA Banner */}
      {formattedEta && (
        <div className="bg-success/10 border-b border-success/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium text-success">Live ETA</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold">{formattedEta}</span>
            <span className="text-xs text-muted-foreground ml-2">({displayDuration})</span>
          </div>
        </div>
      )}

      {/* Current Step - Always Visible */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-4">
          <div className="bg-primary-foreground/20 rounded-full p-3">
            {getManeuverIcon(currentStep.maneuver)}
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg leading-tight">{currentStep.instruction}</p>
            <p className="text-primary-foreground/80 text-sm mt-1">
              {currentStep.distance.text} · {currentStep.duration.text}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {totalDistance} to {destination}
          </span>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              · Updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-xs">{upcomingSteps.length} steps</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Steps List */}
      {isExpanded && upcomingSteps.length > 0 && (
        <ScrollArea className="max-h-48">
          <div className="divide-y divide-border">
            {upcomingSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-3 p-3 hover:bg-muted/30">
                <div className="text-muted-foreground">
                  {getManeuverIcon(step.maneuver)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{step.instruction}</p>
                  <p className="text-xs text-muted-foreground">{step.distance.text}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default NavigationInstructions;
