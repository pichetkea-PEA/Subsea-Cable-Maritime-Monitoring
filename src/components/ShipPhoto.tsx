import React from 'react';
import { ExternalLink } from 'lucide-react';
import { VesselMockup, resolveVesselCategory } from './VesselMockup';

interface ShipPhotoProps {
  mmsi: string;
  shipType?: string;
  vesselName?: string;
  grossTonnage?: number;
  className?: string;
  showBadge?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showDefinition?: boolean;
}

export const ShipPhoto: React.FC<ShipPhotoProps> = ({
  mmsi,
  shipType = 'Passenger ship',
  vesselName = 'Vessel',
  grossTonnage,
  className = '',
  showBadge = true,
  size = 'md',
  showDefinition = true,
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12 rounded-lg',
    md: 'w-24 h-20 rounded-lg',
    lg: 'w-full h-48 rounded-xl',
    full: 'w-full h-full rounded-xl',
  };

  const isCompact = size === 'sm' || size === 'md';

  return (
    <div
      className={`relative overflow-hidden bg-slate-950 border border-slate-800 shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <VesselMockup
        shipType={shipType}
        vesselName={vesselName}
        mmsi={mmsi}
        tonnage={grossTonnage}
        showDefinition={!isCompact && showDefinition}
        className="w-full h-full"
      />
    </div>
  );
};
