import { Ring } from '../../game/types';
import { useGameStore } from '../../store/gameStore';

interface HexRingProps {
  ring: Ring;
  /** Per-HexBoard-instance prefix so gradient ids stay unique across multiple boards on one page. */
  idPrefix?: string;
  x: number;
  y: number;
  size: number;
  isSelected: boolean;
  isRemovable: boolean;
  isCaptureSource: boolean;
  isCaptureTarget: boolean;
  isValidPlacement: boolean;
  /** Position-editor ghost slot for a removed ring — faint, clickable to restore. */
  ghost?: boolean;
  onClick?: (ringId: string) => void;
}

export default function HexRing({
  ring,
  idPrefix = '',
  x,
  y,
  size,
  isSelected,
  isRemovable,
  isCaptureSource,
  isCaptureTarget,
  isValidPlacement,
  ghost,
  onClick,
}: HexRingProps) {
  const { selectRing, handleCapture, selectedRingId, availableCaptureChains } = useGameStore();
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // In online mode, always use the passed onClick handler
    if (onClick) {
      onClick(ring.id);
      return;
    }
    
    // Local mode — use pre-computed chains from the store (set by selectRing).
    if (isCaptureTarget && selectedRingId) {
      const fullChain = availableCaptureChains.find(c => c[c.length - 1].to === ring.id);
      if (fullChain) {
        handleCapture(fullChain);
      }
      return;
    }
    
    selectRing(ring.id);
  };
  
  // Unique gradient id base for this ring within its board instance.
  const gid = `${idPrefix}${ring.id}`;

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

  // Removed ring in the position editor: a faint dashed slot that stays
  // clickable (transparent hit circle) so the author can restore it.
  if (ghost) {
    return (
      <g transform={`translate(${x}, ${y})`} onClick={handleClick} className="cursor-pointer hover:opacity-80">
        <circle cx={0} cy={0} r={outerRadius} fill="transparent" pointerEvents="all" />
        <circle
          cx={0} cy={0} r={size * 0.5}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      </g>
    );
  }

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
        <radialGradient id={`ring-gradient-${gid}`}>
          <stop offset="0%" stopColor="#4a4a4a" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        {ring.marble && (
          <>
            <radialGradient
              id={`marble-gradient-${gid}`}
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
              id={`marble-highlight-${gid}`}
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
        fill={`url(#ring-gradient-${gid})`}
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
            fill={`url(#marble-gradient-${gid})`}
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
            fill={`url(#marble-highlight-${gid})`}
          />
        </g>
      )}
    </g>
  );
}
