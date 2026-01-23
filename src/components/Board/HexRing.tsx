import { Ring } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import { getCaptureChains } from '../../game/GameEngine';

interface HexRingProps {
  ring: Ring;
  x: number;
  y: number;
  size: number;
  isSelected: boolean;
  isRemovable: boolean;
  isCaptureSource: boolean;
  isCaptureTarget: boolean;
  isValidPlacement: boolean;
  onClick?: (ringId: string) => void;
}

export default function HexRing({
  ring,
  x,
  y,
  size,
  isSelected,
  isRemovable,
  isCaptureSource,
  isCaptureTarget,
  isValidPlacement,
  onClick,
}: HexRingProps) {
  const { selectRing, handleCapture, state, selectedRingId } = useGameStore();
  
  const handleClick = () => {
    if (onClick) {
      onClick(ring.id);
      return;
    }
    if (isCaptureTarget && selectedRingId) {
      const chains = getCaptureChains(state, selectedRingId);
      // Find the longest chain that ends at this ring (mandatory full capture)
      const matchingChains = chains.filter(chain => 
        chain.some(c => c.to === ring.id)
      );
      if (matchingChains.length > 0) {
        // Get the full chain - must capture to the end
        const fullChain = matchingChains.reduce((longest, current) => 
          current.length > longest.length ? current : longest
        );
        handleCapture(fullChain);
      }
      return;
    }
    
    selectRing(ring.id);
  };
  
  // Ring visual styling
  // Pure black rings with gradient for contrast with marbles
  let ringStrokeColor = '#1a1a1a';
  let ringStrokeWidth = 3;
  
  if (isSelected) {
    ringStrokeColor = '#3b82f6';
    ringStrokeWidth = 4;
  } else if (isCaptureSource) {
    ringStrokeColor = '#ef4444';
    ringStrokeWidth = 4;
  } else if (isCaptureTarget) {
    ringStrokeColor = '#ef4444';
  } else if (isRemovable) {
    ringStrokeColor = '#22c55e'; // Green for removable rings
    ringStrokeWidth = 4;
  } else if (isValidPlacement) {
    ringStrokeColor = '#22c55e';
    ringStrokeWidth = 4;
  }
  
  const outerRadius = size * 0.85;
  const innerRadius = size * (0.55 / 1.5);
  const marbleRadius = size * 0.46;

  // Compound path (outer circle - inner circle) to create a true hole.
  const ringPath = `
    M 0 0
    m -${outerRadius} 0
    a ${outerRadius} ${outerRadius} 0 1 0 ${outerRadius * 2} 0
    a ${outerRadius} ${outerRadius} 0 1 0 -${outerRadius * 2} 0
    M 0 0
    m -${innerRadius} 0
    a ${innerRadius} ${innerRadius} 0 1 1 ${innerRadius * 2} 0
    a ${innerRadius} ${innerRadius} 0 1 1 -${innerRadius * 2} 0
  `;
  
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      className="cursor-pointer transition-all duration-150 hover:opacity-90"
    >
      <circle
        cx={0}
        cy={0}
        r={outerRadius}
        fill="transparent"
        pointerEvents="all"
      />
      <defs>
        <radialGradient id={`ring-gradient-${ring.id}`}>
          <stop offset="0%" stopColor="#4a4a4a" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
      </defs>
      <path
        d={ringPath}
        fill={`url(#ring-gradient-${ring.id})`}
        fillRule="evenodd"
        stroke={ringStrokeColor}
        strokeWidth={ringStrokeWidth}
      />
      
      {/* Marble (smaller than inner hole, sits on top of ring) */}
      {ring.marble && (
        <circle
          cx={0}
          cy={0}
          r={marbleRadius}
          fill={
            ring.marble.color === 'white' ? '#f9fafb' :
            ring.marble.color === 'gray' ? '#9ca3af' :
            '#374151'
          }
          stroke={
            ring.marble.color === 'white' ? '#d1d5db' :
            ring.marble.color === 'gray' ? '#6b7280' :
            '#4b5563'
          }
          strokeWidth={2}
          style={{
            filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.4))',
          }}
        />
      )}
    </g>
  );
}
