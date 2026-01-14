import { useState, useMemo, type WheelEvent } from 'react';
import { useGameStore } from '../../store/gameStore';
import { hexToPixel } from '../../game/Board';
import { getValidRemovableRings } from '../../game/Board';
import { hasAvailableCaptures, getAvailableCaptures } from '../../game/GameEngine';
import HexRing from './HexRing';

const HEX_SIZE = 28;
const BOARD_PADDING = 60;
const RING_SPACING = 35; // Increased spacing between rings
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

export default function HexBoard() {
  const { state, selectedRingId, highlightedCaptures } = useGameStore();
  const [zoom, setZoom] = useState(1);
  
  const { rings, positions, bounds } = useMemo(() => {
    const ringsArray = Array.from(state.rings.values()).filter(r => !r.isRemoved);
    const positions = new Map<string, { x: number; y: number }>();
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const ring of ringsArray) {
      const pos = hexToPixel(ring.q, ring.r, RING_SPACING);
      positions.set(ring.id, pos);
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    }
    
    return {
      rings: ringsArray,
      positions,
      bounds: { minX, maxX, minY, maxY },
    };
  }, [state.rings]);
  
  const width = bounds.maxX - bounds.minX + BOARD_PADDING * 2;
  const height = bounds.maxY - bounds.minY + BOARD_PADDING * 2;
  const offsetX = -bounds.minX + BOARD_PADDING;
  const offsetY = -bounds.minY + BOARD_PADDING;
  
  const validRemovableRings = useMemo(() => {
    if (state.phase === 'ringRemoval') {
      return new Set(getValidRemovableRings(state.rings));
    }
    return new Set<string>();
  }, [state.phase, state.rings]);
  
  const captureTargets = useMemo(() => {
    if (hasAvailableCaptures(state)) {
      const captures = getAvailableCaptures(state);
      return new Set(captures.map(c => c.from));
    }
    return new Set<string>();
  }, [state]);
  
  const highlightedRings = useMemo(() => {
    return new Set(highlightedCaptures.map(c => c.to));
  }, [highlightedCaptures]);
  
  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    // wheel down -> zoom out, wheel up -> zoom in
    const delta = e.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    setZoom(newZoom);
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className="relative">
        <svg
          width={width}
          height={height}
          // Camera zoom: change viewBox, keep geometry (spacing) intact
          viewBox={`0 0 ${width / zoom} ${height / zoom}`}
          className="max-w-full max-h-[60vh] cursor-move"
          onWheel={handleWheel}
        >
          <g transform={`translate(${offsetX}, ${offsetY})`}>
            {rings.map(ring => {
              const pos = positions.get(ring.id);
              if (!pos) return null;
              
              const isSelected = ring.id === selectedRingId;
              const isRemovable = validRemovableRings.has(ring.id);
              const isCaptureSource = captureTargets.has(ring.id);
              const isCaptureTarget = highlightedRings.has(ring.id);
              const isValidPlacement = false; // Remove green highlight for placement
              
              return (
                <HexRing
                  key={ring.id}
                  ring={ring}
                  x={pos.x}
                  y={pos.y}
                  size={HEX_SIZE}
                  isSelected={isSelected}
                  isRemovable={isRemovable}
                  isCaptureSource={isCaptureSource}
                  isCaptureTarget={isCaptureTarget}
                  isValidPlacement={isValidPlacement}
                />
              );
            })}
          </g>
        </svg>
        <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
          Zoom: {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}
