import { useState, useMemo, useRef, useId, type WheelEvent } from 'react';
import { useGameStore } from '../../store/gameStore';
import { hexToPixel } from '../../game/Board';
import { getValidRemovableRings } from '../../game/Board';
import { hasAvailableCaptures, getAvailableCaptures } from '../../game/GameEngine';
import HexRing from './HexRing';
import { GameState, CaptureMove } from '../../game/types';

const HEX_SIZE = 28;
const BOARD_PADDING = 60;
const RING_SPACING = 35; // Increased spacing between rings
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

interface HexBoardProps {
  state?: GameState;
  selectedRingId?: string | null;
  highlightedCaptures?: CaptureMove[];
  validRemovableRings?: string[];
  onRingClick?: (ringId: string) => void;
  /** Static thumbnail mode: fills its parent, no zoom/pan, no zoom badge. */
  preview?: boolean;
  /** Position-editor mode: keep removed rings as clickable ghost slots so they
   *  can be restored, and keep full-board bounds. */
  editable?: boolean;
}

export default function HexBoard(props: HexBoardProps = {}) {
  const gameStore = useGameStore();
  const state = props.state || gameStore.state;
  const selectedRingId = props.selectedRingId !== undefined ? props.selectedRingId : gameStore.selectedRingId;
  const highlightedCaptures = props.highlightedCaptures || gameStore.highlightedCaptures;
  // Unique per-instance prefix for SVG gradient ids. Multiple HexBoards can be on
  // one page (e.g. the menu current-games previews + the hidden mobile carousel);
  // without a unique prefix their duplicate gradient ids collide and `url(#id)`
  // fails to resolve, leaving ring fills transparent. Strip colons so the id is
  // safe inside url(#...).
  const gradPrefix = `hb${useId().replace(/:/g, '')}`;
  const [zoom, setZoom] = useState(1);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const getPinchDist = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      pinchRef.current = { dist: getPinchDist(e.touches), zoom };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const scale = getPinchDist(e.touches) / pinchRef.current.dist;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchRef.current.zoom * scale));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };
  
  const { rings, positions, bounds } = useMemo(() => {
    const all = Array.from(state.rings.values());
    const ringsArray = props.editable ? all : all.filter(r => !r.isRemoved);
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
  }, [state.rings, props.editable]);
  
  // In preview (thumbnail) mode the board should fill the square edge-to-edge,
  // so pad only by a ring radius instead of the full interactive breathing room.
  const pad = props.preview ? HEX_SIZE + 6 : BOARD_PADDING;
  const width = bounds.maxX - bounds.minX + pad * 2;
  const height = bounds.maxY - bounds.minY + pad * 2;
  const offsetX = -bounds.minX + pad;
  const offsetY = -bounds.minY + pad;

  const viewWidth = width / zoom;
  const viewHeight = height / zoom;
  const viewX = (width - viewWidth) / 2;
  const viewY = (height - viewHeight) / 2;
  
  const validRemovableRings = useMemo(() => {
    if (props.validRemovableRings) {
      return new Set(props.validRemovableRings);
    }
    if (state.phase === 'ringRemoval') {
      return new Set(getValidRemovableRings(state.rings));
    }
    return new Set<string>();
  }, [state.phase, state.rings, props.validRemovableRings]);
  
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

  const { preview } = props;

  return (
    <div className={preview ? 'flex items-center justify-center w-full h-full' : 'flex items-center justify-center p-2 sm:p-3 md:p-4 w-full'}>
      <div className={`relative rounded-2xl bg-[radial-gradient(circle_at_center,_#8A9AAB_0%,_#5A6978_100%)] shadow-lg overflow-hidden ${preview ? 'w-full h-full p-0' : 'w-full max-w-[1100px] p-3 sm:p-4'}`}>
        <svg
          // Camera zoom: change viewBox, keep geometry (spacing) intact
          viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className={preview ? 'w-full h-full' : 'w-full h-[46vh] sm:h-[56vh] md:h-[64vh] lg:h-[80vh] max-h-[760px] cursor-move'}
          style={{ touchAction: 'none' }}
          onWheel={preview ? undefined : handleWheel}
          onTouchStart={preview ? undefined : handleTouchStart}
          onTouchMove={preview ? undefined : handleTouchMove}
          onTouchEnd={preview ? undefined : handleTouchEnd}
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
                  idPrefix={gradPrefix}
                  x={pos.x}
                  y={pos.y}
                  size={HEX_SIZE}
                  isSelected={isSelected}
                  isRemovable={isRemovable}
                  isCaptureSource={isCaptureSource}
                  isCaptureTarget={isCaptureTarget}
                  isValidPlacement={isValidPlacement}
                  ghost={ring.isRemoved}
                  onClick={props.onRingClick}
                />
              );
            })}
          </g>
        </svg>
        {!preview && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
            Zoom: {Math.round(zoom * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}
