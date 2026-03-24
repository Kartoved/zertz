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
  let glowFilter = '';
  
  if (isSelected) {
    ringStrokeColor = '#ef4444';
    ringStrokeWidth = 4;
    glowFilter = 'drop-shadow(0 0 6px rgba(239,68,68,0.8)) drop-shadow(0 0 12px rgba(239,68,68,0.5))';
  } else if (isCaptureSource) {
    ringStrokeColor = '#ef4444';
    ringStrokeWidth = 4;
    glowFilter = 'drop-shadow(0 0 6px rgba(239,68,68,0.8)) drop-shadow(0 0 12px rgba(239,68,68,0.5))';
  } else if (isCaptureTarget) {
    ringStrokeColor = '#ef4444';
    glowFilter = 'drop-shadow(0 0 5px rgba(239,68,68,0.7)) drop-shadow(0 0 10px rgba(239,68,68,0.4))';
  } else if (isRemovable) {
    ringStrokeColor = '#4ade80'; // Lighter green for removable rings
    ringStrokeWidth = 2;
  } else if (isValidPlacement) {
    ringStrokeColor = '#4ade80';
    ringStrokeWidth = 2;
  }
  
  const outerRadius = size * 0.85;
  const innerRadius = size * (0.55 / 1.5);
  const marbleRadius = size * 0.58;

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
          <>
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
                  <stop offset="40%" stopColor="#f5f5f5" />
                  <stop offset="80%" stopColor="#e0e0e0" />
                  <stop offset="100%" stopColor="#c8c8c8" />
                </>
              )}
              {ring.marble.color === 'gray' && (
                <>
                  <stop offset="0%" stopColor="#b8bcc4" />
                  <stop offset="40%" stopColor="#8b919c" />
                  <stop offset="80%" stopColor="#5c6370" />
                  <stop offset="100%" stopColor="#3d4350" />
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
            {/* Specular highlight */}
            <radialGradient
              id={`marble-highlight-${ring.id}`}
              cx="30%"
              cy="25%"
              r="30%"
              fx="28%"
              fy="22%"
            >
              {ring.marble.color === 'white' && (
                <>
                  <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </>
              )}
              {ring.marble.color === 'gray' && (
                <>
                  <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </>
              )}
              {ring.marble.color === 'black' && (
                <>
                  <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </>
              )}
            </radialGradient>
          </>
        )}
      </defs>
      <path
        d={ringPath}
        fill={`url(#ring-gradient-${ring.id})`}
        fillRule="evenodd"
        stroke={ringStrokeColor}
        strokeWidth={ringStrokeWidth}
        style={{ filter: `drop-shadow(0px 5px 6px rgba(0,0,0,0.5))${glowFilter ? ' ' + glowFilter : ''}` }}
      />
      
      {/* Marble (smaller than inner hole, sits on top of ring) */}
      {ring.marble && (
        <g style={{
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.7)) drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
        }}>
          <circle
            cx={0}
            cy={0}
            r={marbleRadius}
            fill={`url(#marble-gradient-${ring.id})`}
            stroke={
              ring.marble.color === 'white' ? '#b0b0b0' :
              ring.marble.color === 'gray' ? '#3d4350' :
              '#000000'
            }
            strokeWidth={1.5}
          />
          {/* Specular highlight overlay */}
          <circle
            cx={0}
            cy={0}
            r={marbleRadius}
            fill={`url(#marble-highlight-${ring.id})`}
          />
        </g>
      )}
    </g>
  );
}
