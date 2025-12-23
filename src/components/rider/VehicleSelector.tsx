import { Bike, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

type VehicleType = 'bike' | 'auto' | 'cab';

interface VehicleSelectorProps {
  selected: VehicleType;
  onSelect: (type: VehicleType) => void;
  fareEstimates?: {
    bike?: number;
    auto?: number;
    cab?: number;
  };
}

const vehicles = [
  {
    type: 'bike' as const,
    label: 'Bike',
    icon: Bike,
    description: 'Quick & affordable',
    seats: 1,
  },
  {
    type: 'auto' as const,
    label: 'Auto',
    icon: Car,
    description: 'Comfortable ride',
    seats: 3,
  },
  {
    type: 'cab' as const,
    label: 'Cab',
    icon: Car,
    description: 'Premium comfort',
    seats: 4,
  },
];

const VehicleSelector = ({ selected, onSelect, fareEstimates }: VehicleSelectorProps) => {
  return (
    <div className="flex gap-3">
      {vehicles.map((vehicle) => (
        <button
          key={vehicle.type}
          onClick={() => onSelect(vehicle.type)}
          className={cn(
            'flex-1 p-4 rounded-xl border-2 transition-all',
            selected === vehicle.type
              ? 'border-primary bg-primary/5'
              : 'border-border bg-card hover:border-primary/50'
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              selected === vehicle.type ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}>
              <vehicle.icon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="font-semibold">{vehicle.label}</p>
              <p className="text-xs text-muted-foreground">{vehicle.description}</p>
              {fareEstimates?.[vehicle.type] && (
                <p className="text-sm font-bold text-primary mt-1">
                  ₹{fareEstimates[vehicle.type]}
                </p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default VehicleSelector;
