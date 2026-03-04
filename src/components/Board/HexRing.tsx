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
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[HexRing.handleClick]', { ringId: ring.id, hasOnClick: !!onClick });
    
    // In online mode, always use the passed onClick handler
    if (onClick) {
      console.log('[HexRing] calling onClick', ring.id);
      onClick(ring.id);
      return;
    }
    
    // Local mode - use gameStore
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
    ringStrokeColor = '#4ade80'; // Lighter green for removable rings
    ringStrokeWidth = 2;
  } else if (isValidPlacement) {
    ringStrokeColor = '#4ade80';
    ringStrokeWidth = 2;
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
        {ring.marble && (
          <radialGradient
            id={`marble-gradient-${ring.id}`}
            cx="35%"
            cy="35%"
            r="65%"
            fx="30%"
            fy="30%"
          >
            {ring.marble.color === 'white' && (
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#d1d5db" />
                <stop offset="100%" stopColor="#9ca3af" />
              </>
            )}
            {ring.marble.color === 'gray' && (
              <>
                <stop offset="0%" stopColor="#d1d5db" />
                <stop offset="50%" stopColor="#9ca3af" />
                <stop offset="100%" stopColor="#4b5563" />
              </>
            )}
            {ring.marble.color === 'black' && (
              <>
                <stop offset="0%" stopColor="#6b7280" />
                <stop offset="50%" stopColor="#374151" />
                <stop offset="100%" stopColor="#111827" />
              </>
            )}
          </radialGradient>
        )}
      </defs>
      <path
        d={ringPath}
        fill={`url(#ring-gradient-${ring.id})`}
        fillRule="evenodd"
        stroke={ringStrokeColor}
        strokeWidth={ringStrokeWidth}
        style={{ filter: 'drop-shadow(0px 5px 6px rgba(0,0,0,0.5))' }}
      />
      
      {/* Marble (smaller than inner hole, sits on top of ring) */}
      {ring.marble && (
        <circle
          cx={0}
          cy={0}
          r={marbleRadius}
          fill={`url(#marble-gradient-${ring.id})`}
          stroke={
            ring.marble.color === 'white' ? '#9ca3af' :
            ring.marble.color === 'gray' ? '#4b5563' :
            '#1f2937'
          }
          strokeWidth={1}
          style={{
            filter: 'drop-shadow(0 6px 6px rgba(0,0,0,0.6)) drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
          }}
        />
      )}
    </g>
  );
}
