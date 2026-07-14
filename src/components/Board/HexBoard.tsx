import { useState, useMemo, useRef, useId, type WheelEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useGameStore } from '../../store/gameStore';
import { hexToPixel } from '../../game/Board';
import { getValidRemovableRings } from '../../game/Board';
import { hasAvailableCaptures, getAvailableCaptures } from '../../game/GameEngine';
import HexRing from './HexRing';
import { GameState, CaptureMove, Shape, ShapeBrush } from '../../game/types';

const HEX_SIZE = 28;
const BOARD_PADDING = 60;
const RING_SPACING = 35; // Increased spacing between rings
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

const BRUSH_COLORS: Record<ShapeBrush, string> = {
  green: '#22c55e', red: '#ef4444', blue: '#3b82f6', yellow: '#eab308',
};

function brushFromEvent(e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): ShapeBrush {
  if (e.shiftKey) return 'red';
  if (e.altKey) return 'blue';
  if (e.ctrlKey || e.metaKey) return 'yellow';
  return 'green';
}

type Pt = { x: number; y: number };

function Arrow({ x1, y1, x2, y2, color, opacity = 0.85 }: { x1: number; y1: number; x2: number; y2: number; color: string; opacity?: number }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const sx = x1 + ux * HEX_SIZE * 0.55, sy = y1 + uy * HEX_SIZE * 0.55; // start off the origin ring
  const tx = x2 - ux * HEX_SIZE * 0.75, ty = y2 - uy * HEX_SIZE * 0.75; // tip just short of dest center
  const headLen = HEX_SIZE * 0.6, headW = HEX_SIZE * 0.42;
  const bx = tx - ux * headLen, by = ty - uy * headLen; // head base
  const px = -uy, py = ux;
  return (
    <g opacity={opacity}>
      <line x1={sx} y1={sy} x2={bx} y2={by} stroke={color} strokeWidth={HEX_SIZE * 0.2} strokeLinecap="round" />
      <polygon points={`${tx},${ty} ${bx + px * headW},${by + py * headW} ${bx - px * headW},${by - py * headW}`} fill={color} />
    </g>
  );
}

function ShapeMark({ shape, positions }: { shape: Shape; positions: Map<string, Pt> }) {
  const o = positions.get(shape.orig);
  if (!o) return null;
  const color = BRUSH_COLORS[shape.brush];
  if (!shape.dest) {
    return <circle cx={o.x} cy={o.y} r={HEX_SIZE * 0.92} fill="none" stroke={color} strokeWidth={HEX_SIZE * 0.14} opacity={0.85} />;
  }
  const d = positions.get(shape.dest);
  if (!d) return null;
  return <Arrow x1={o.x} y1={o.y} x2={d.x} y2={d.y} color={color} />;
}

function ShapePreview({ draw, positions }: { draw: { orig: string; x: number; y: number; brush: ShapeBrush }; positions: Map<string, Pt> }) {
  const o = positions.get(draw.orig);
  if (!o) return null;
  const color = BRUSH_COLORS[draw.brush];
  const dx = draw.x - o.x, dy = draw.y - o.y;
  const nearOrigin = dx * dx + dy * dy < (HEX_SIZE * 0.6) * (HEX_SIZE * 0.6);
  if (nearOrigin) {
    return <circle cx={o.x} cy={o.y} r={HEX_SIZE * 0.92} fill="none" stroke={color} strokeWidth={HEX_SIZE * 0.14} opacity={0.55} />;
  }
  return <Arrow x1={o.x} y1={o.y} x2={draw.x} y2={draw.y} color={color} opacity={0.55} />;
}

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
  /** Annotation shapes (arrows/circles) to render over the board. */
  shapes?: Shape[];
  /** Enable right-click drawing of shapes (desktop). Emits completed shapes. */
  drawable?: boolean;
  /** Called when a shape is drawn (right-drag = arrow, right-click = circle). */
  onShapeDraw?: (shape: Shape) => void;
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

  // ── Right-click annotation drawing (desktop; Studies) ──
  const svgRef = useRef<SVGSVGElement>(null);
  const drawOriginRef = useRef<string | null>(null);
  const [drawState, setDrawState] = useState<{ orig: string; x: number; y: number; brush: ShapeBrush } | null>(null);

  const toLocal = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    const u = p.matrixTransform(ctm.inverse());
    return { x: u.x - offsetX, y: u.y - offsetY };
  };

  const ringAtLocal = (x: number, y: number): string | null => {
    let best: string | null = null;
    let bestD = HEX_SIZE * HEX_SIZE;
    for (const [id, p] of positions) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  };

  const handleDrawDown = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (e.button !== 2) return;
    const loc = toLocal(e.clientX, e.clientY);
    const ring = loc && ringAtLocal(loc.x, loc.y);
    if (!ring) return;
    e.preventDefault();
    drawOriginRef.current = ring;
    const p = positions.get(ring)!;
    setDrawState({ orig: ring, x: p.x, y: p.y, brush: brushFromEvent(e) });
  };

  const handleDrawMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!drawOriginRef.current) return;
    const loc = toLocal(e.clientX, e.clientY);
    if (loc) setDrawState(s => (s ? { ...s, x: loc.x, y: loc.y, brush: brushFromEvent(e) } : s));
  };

  const handleDrawUp = (e: ReactMouseEvent<SVGSVGElement>) => {
    const orig = drawOriginRef.current;
    if (!orig || e.button !== 2) return;
    drawOriginRef.current = null;
    setDrawState(null);
    const loc = toLocal(e.clientX, e.clientY);
    const dest = loc ? ringAtLocal(loc.x, loc.y) : null;
    const brush = brushFromEvent(e);
    props.onShapeDraw?.(dest && dest !== orig ? { orig, dest, brush } : { orig, brush });
  };

  const cancelDraw = () => { drawOriginRef.current = null; setDrawState(null); };

  const { preview } = props;

  return (
    <div className={preview ? 'flex items-center justify-center w-full h-full' : 'flex items-center justify-center p-2 sm:p-3 md:p-4 w-full'}>
      <div className={`relative rounded-2xl bg-[radial-gradient(circle_at_center,_#8A9AAB_0%,_#5A6978_100%)] shadow-lg overflow-hidden ${preview ? 'w-full h-full p-0' : 'w-full max-w-[1100px] p-3 sm:p-4'}`}>
        <svg
          ref={svgRef}
          // Camera zoom: change viewBox, keep geometry (spacing) intact
          viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className={preview ? 'w-full h-full' : 'w-full h-[46vh] sm:h-[56vh] md:h-[64vh] lg:h-[80vh] max-h-[760px] cursor-move'}
          style={{ touchAction: 'none' }}
          onWheel={preview ? undefined : handleWheel}
          onTouchStart={preview ? undefined : handleTouchStart}
          onTouchMove={preview ? undefined : handleTouchMove}
          onTouchEnd={preview ? undefined : handleTouchEnd}
          onContextMenu={props.drawable ? (e) => e.preventDefault() : undefined}
          onMouseDown={props.drawable ? handleDrawDown : undefined}
          onMouseMove={props.drawable ? handleDrawMove : undefined}
          onMouseUp={props.drawable ? handleDrawUp : undefined}
          onMouseLeave={props.drawable ? cancelDraw : undefined}
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

            {/* Annotation shapes (arrows/circles) + live drawing preview */}
            {(props.shapes?.length || drawState) && (
              <g style={{ pointerEvents: 'none' }}>
                {props.shapes?.map((s, i) => <ShapeMark key={`sh-${i}-${s.orig}-${s.dest ?? ''}`} shape={s} positions={positions} />)}
                {drawState && <ShapePreview draw={drawState} positions={positions} />}
              </g>
            )}
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
