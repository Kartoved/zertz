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
}: HexRingProps) {
  const { selectRing, handleCapture, state, selectedRingId } = useGameStore();
  
  const handleClick = () => {
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
  let ringColor = '#4b5563'; // Gray ring
  let ringStrokeColor = '#374151';
  let ringStrokeWidth = 3;
  
  if (isSelected) {
    ringStrokeColor = '#3b82f6';
    ringStrokeWidth = 4;
  } else if (isCaptureSource) {
    ringStrokeColor = '#ef4444';
    ringStrokeWidth = 4;
  } else if (isCaptureTarget) {
    ringColor = '#fecaca';
    ringStrokeColor = '#ef4444';
  } else if (isRemovable) {
    ringStrokeColor = '#eab308';
    ringStrokeWidth = 4;
  } else if (isValidPlacement) {
    ringStrokeColor = '#22c55e';
    ringStrokeWidth = 4;
  }
  
  const outerRadius = size * 0.85;
  const innerRadius = size * 0.55;
  const marbleRadius = size * 0.4;
  
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      className="cursor-pointer transition-all duration-150 hover:opacity-90"
    >
      {/* Outer ring circle */}
      <circle
        cx={0}
        cy={0}
        r={outerRadius}
        fill={ringColor}
        stroke={ringStrokeColor}
        strokeWidth={ringStrokeWidth}
      />
      
      {/* Inner hole - makes it look like a ring */}
      <circle
        cx={0}
        cy={0}
        r={innerRadius}
        fill="#111827"
        stroke="#1f2937"
        strokeWidth={1}
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
            '#1f2937'
          }
          stroke={
            ring.marble.color === 'white' ? '#d1d5db' :
            ring.marble.color === 'gray' ? '#6b7280' :
            '#374151'
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
