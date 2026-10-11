import { useState, useMemo, useRef, useId, useEffect, useLayoutEffect, type WheelEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useI18n } from '../../i18n';
import { hexToPixel, idToAlgebraic } from '../../game/Board';
import { getValidRemovableRings } from '../../game/Board';
import { hasAvailableCaptures, getAvailableCaptures, applyCaptureSteps } from '../../game/GameEngine';
import HexRing from './HexRing';
import { toggleShape } from '../../game/shapes';
import { diffBoards, snapshotBoard, type BoardAnim, type BoardSnap } from './boardAnimation';
import { Marble, MarbleDefs, seedFromId } from './marbleStyle';
import { GameState, CaptureMove, Shape, ShapeBrush, Move, MarbleColor } from '../../game/types';

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

const LAST_MOVE_COLOR = '#facc15';
/** Capture paths (in progress and last move) and the captured-marble dots. */
const CAPTURE_COLOR = '#ef4444';

/** A faded copy of a captured marble on the ring it was taken from. */
function CapturedGhost({ p, color, prefix, ringId }: { p: Pt; color: MarbleColor; prefix: string; ringId: string }) {
  return (
    <g transform={`translate(${p.x}, ${p.y})`}>
      <Marble prefix={prefix} color={color} r={HEX_SIZE * 0.58} seed={seedFromId(ringId)} opacity={0.5} />
    </g>
  );
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** A marble copy flying hop by hop along `points`, then fading out where the
 *  real marble appears. Driven by the Web Animations API (SVG transforms). */
function FlyingMarble({ color, points, hopMs, animKey, prefix }: { color: MarbleColor; points: Pt[]; hopMs: number; animKey: number; prefix: string }) {
  const ref = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || points.length < 2 || typeof el.animate !== 'function') return;
    const total = hopMs * (points.length - 1);
    const move = el.animate(
      points.map(p => ({ transform: `translate(${p.x}px, ${p.y}px)` })),
      { duration: total, easing: 'ease-in-out', fill: 'forwards' },
    );
    const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { delay: total, duration: 60, fill: 'forwards' });
    return () => { move.cancel(); fade.cancel(); };
    // Keyed on the animation, not on `points` (a fresh array every parent render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);
  return (
    <g ref={ref} style={{ transform: `translate(${points[0].x}px, ${points[0].y}px)`, filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.6))' }}>
      <Marble prefix={prefix} color={color} r={HEX_SIZE * 0.58} />
    </g>
  );
}

/** Lichess-style "last move" marks: a halo where a marble landed, a dashed ghost
 *  where a ring was taken away, and the jump path of a capture chain. */
function LastMoveMarks({ move, pointOf, prefix, fadeTrace }: { move: Move; pointOf: (id: string) => Pt | null; prefix: string; fadeTrace?: boolean }) {
  const halo = (p: Pt, key: string) => (
    <circle key={key} cx={p.x} cy={p.y} r={HEX_SIZE * 1.02} fill="none" stroke={LAST_MOVE_COLOR} strokeWidth={HEX_SIZE * 0.13} opacity={0.75} />
  );
  if (move.type === 'placement') {
    const placed = pointOf(move.data.ringId);
    const removed = move.data.removedRingId ? pointOf(move.data.removedRingId) : null;
    return (
      <>
        {placed && halo(placed, 'placed')}
        {removed && (
          <circle cx={removed.x} cy={removed.y} r={HEX_SIZE * 0.85} fill={LAST_MOVE_COLOR} fillOpacity={0.12}
            stroke={LAST_MOVE_COLOR} strokeWidth={HEX_SIZE * 0.08} strokeDasharray={`${HEX_SIZE * 0.25} ${HEX_SIZE * 0.18}`} opacity={0.8} />
        )}
      </>
    );
  }
  const jumps = [move.data, ...(move.data.chain || [])];
  const path = [pointOf(jumps[0].from), ...jumps.map(j => pointOf(j.to))].filter((p): p is Pt => !!p);
  const end = path[path.length - 1];
  // The capture trace (path, captured ghosts + dots) can fade out so it doesn't
  // clutter the next move; the from/to halos stay. Keyed on the move's content
  // so a re-render (e.g. an online poll) doesn't restart the fade.
  const traceKey = jumps.map(j => `${j.from}>${j.to}`).join('|');
  return (
    <>
      <g key={traceKey} className={fadeTrace ? 'zz-trace-fade' : undefined}>
        {jumps.map((j, i) => {
          const c = pointOf(j.captured);
          return c && j.capturedColor ? <CapturedGhost key={`cg-${i}`} p={c} color={j.capturedColor} prefix={prefix} ringId={j.captured} /> : null;
        })}
        {path.length > 1 && (
          <polyline points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={CAPTURE_COLOR}
            strokeWidth={HEX_SIZE * 0.1} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
        )}
        {jumps.map((j, i) => {
          const c = pointOf(j.captured);
          return c ? <circle key={`cap-${i}`} cx={c.x} cy={c.y} r={HEX_SIZE * 0.22} fill={CAPTURE_COLOR} opacity={0.8} /> : null;
        })}
      </g>
      {path[0] && <circle cx={path[0].x} cy={path[0].y} r={HEX_SIZE * 0.9} fill="none" stroke={LAST_MOVE_COLOR} strokeWidth={HEX_SIZE * 0.08} opacity={0.6} />}
      {end && halo(end, 'end')}
    </>
  );
}

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
  /** Right click on a ring (position editor: erase). Not combined with `drawable`. */
  onRingRightClick?: (ringId: string) => void;
  /** Static thumbnail mode: fills its parent, no zoom/pan, no zoom badge. */
  preview?: boolean;
  /** Position-editor mode: keep removed rings as clickable ghost slots so they
   *  can be restored, and keep full-board bounds. */
  editable?: boolean;
  /** Annotation shapes (arrows/circles) to render over the board. */
  shapes?: Shape[];
  /** Enable right-click drawing of shapes (desktop). Without `onShapeDraw` the
   *  shapes are ephemeral (Lichess-style): kept inside the board, visible only to
   *  this viewer, wiped on any position change or a left click. */
  drawable?: boolean;
  /** Called when a shape is drawn (right-drag = arrow, right-click = circle).
   *  When given, the caller owns the shapes and passes them back via `shapes`. */
  onShapeDraw?: (shape: Shape) => void;
  /** Clear every shape on this position (🧹 button / Esc). Needed when the
   *  caller owns the shapes (`onShapeDraw`); ephemeral shapes clear themselves. */
  onClearShapes?: () => void;
  /** Allow coordinate labels + the "a1" toggle on a `preview`-layout board
   *  (full-size boards always have them; tiny thumbnails never do). */
  coordinates?: boolean;
  /** The move that led to this position — highlighted on the board. */
  lastMove?: Move | null;
  /** Fade a capture's trace (path + captured marbles) out after a moment —
   *  for the live end of a line, where it would get in the way of the next move.
   *  When browsing history it should stay (leave this off). */
  fadeLastMoveTrace?: boolean;
  /** Jumps of a capture chain taken so far (jump-by-jump input): the board
   *  shows the in-between position and marks the jumped path. */
  capturePath?: CaptureMove[];
}

export default function HexBoard(props: HexBoardProps = {}) {
  // Subscribe to the *effective* value (prop overrides store), so a preview
  // board — which passes everything as props — returns its stable prop
  // reference and never re-renders on unrelated gameStore changes, while a live
  // board still reacts to just these slices.
  const baseState = useGameStore(s => props.state || s.state);
  const capturePath = props.capturePath;
  const state = useMemo(
    () => (capturePath?.length ? applyCaptureSteps(baseState, capturePath) : baseState),
    [baseState, capturePath],
  );

  // ── Move animations ──
  // Compare each new position with the previous one; a single forward step is
  // animated (see boardAnimation.ts). Runs in a layout effect so the re-render
  // with the animation lands before the browser paints the new position.
  const animEnabled = !props.preview && !props.editable;
  const prevSnapRef = useRef<BoardSnap | null>(null);
  const animKeyRef = useRef(0);
  const [anim, setAnim] = useState<(BoardAnim & { key: number }) | null>(null);
  const hintPath = useMemo((): string[] | null => {
    if (capturePath?.length) {
      const j = capturePath[capturePath.length - 1];
      return [j.from, j.to];
    }
    const m = props.lastMove;
    if (m?.type === 'capture') {
      const jumps = [m.data, ...(m.data.chain || [])];
      return [jumps[0].from, ...jumps.map(j => j.to)];
    }
    return null;
  }, [capturePath, props.lastMove]);
  useLayoutEffect(() => {
    const snap = snapshotBoard(state);
    const prev = prevSnapRef.current;
    prevSnapRef.current = snap;
    if (!animEnabled || !prev) return;
    const next = prefersReducedMotion() ? null : diffBoards(prev, snap, hintPath);
    if (!next) { setAnim(null); return; }
    const key = ++animKeyRef.current;
    setAnim({ ...next, key });
    const timer = setTimeout(() => setAnim(cur => (cur?.key === key ? null : cur)), next.totalMs + 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const selectedRingId = useGameStore(s => (props.selectedRingId !== undefined ? props.selectedRingId : s.selectedRingId));
  const highlightedCaptures = useGameStore(s => props.highlightedCaptures || s.highlightedCaptures);
  // Unique per-instance prefix for SVG gradient ids. Multiple HexBoards can be on
  // one page (e.g. the menu current-games previews + the hidden mobile carousel);
  // without a unique prefix their duplicate gradient ids collide and `url(#id)`
  // fails to resolve, leaving ring fills transparent. Strip colons so the id is
  // safe inside url(#...).
  const gradPrefix = `hb${useId().replace(/:/g, '')}`;
  // Coordinate labels are a shared, persisted UI preference (see uiStore). Never
  // shown in tiny thumbnail (preview) boards.
  const coordsAllowed = !props.preview || !!props.coordinates;
  const showCoordinates = useUIStore(s => s.showCoordinates) && coordsAllowed;
  const toggleCoordinates = useUIStore(s => s.toggleCoordinates);
  const { t } = useI18n();
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
  // Coordinate labels sit HEX_SIZE+6 beyond the outer rings — leave room for them.
  const pad = props.preview ? (showCoordinates ? HEX_SIZE * 2 + 14 : HEX_SIZE + 6) : BOARD_PADDING;
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
    // Mid-chain only the jumping marble may move on — don't advertise others.
    if (capturePath?.length) return new Set<string>();
    if (hasAvailableCaptures(state)) {
      const captures = getAvailableCaptures(state);
      return new Set(captures.map(c => c.from));
    }
    return new Set<string>();
  }, [state, capturePath]);
  
  const highlightedRings = useMemo(() => {
    return new Set(highlightedCaptures.map(c => c.to));
  }, [highlightedCaptures]);

  // Per-column coordinate labels: for each vertical (same q), tag the bottom-most
  // visible ring below it (a1, b1, …) and the top-most visible ring above it
  // (a4, b5, …). Attaches to actual rings so the labels track the board's real
  // outline even after rings are removed.
  const coordLabels = useMemo(() => {
    if (!showCoordinates) return [];
    const byCol = new Map<number, { x: number; topId: string; topY: number; botId: string; botY: number }>();
    for (const ring of rings) {
      if (ring.isRemoved) continue;
      const pos = positions.get(ring.id);
      if (!pos) continue;
      const c = byCol.get(ring.q);
      if (!c) {
        byCol.set(ring.q, { x: pos.x, topId: ring.id, topY: pos.y, botId: ring.id, botY: pos.y });
      } else {
        c.x = pos.x;
        if (pos.y < c.topY) { c.topY = pos.y; c.topId = ring.id; }
        if (pos.y > c.botY) { c.botY = pos.y; c.botId = ring.id; }
      }
    }
    const gap = HEX_SIZE + 6;
    const labels: { key: string; x: number; y: number; text: string }[] = [];
    for (const c of byCol.values()) {
      labels.push({ key: `b-${c.botId}`, x: c.x, y: c.botY + gap, text: idToAlgebraic(c.botId, state.boardSize) });
      // Single-ring column: bottom and top are the same ring — one label only.
      if (c.topId !== c.botId) {
        labels.push({ key: `t-${c.topId}`, x: c.x, y: c.topY - gap, text: idToAlgebraic(c.topId, state.boardSize) });
      }
    }
    return labels;
  }, [showCoordinates, rings, positions, state.boardSize]);
  
  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    // wheel down -> zoom out, wheel up -> zoom in
    const delta = e.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    setZoom(newZoom);
  };

  // ── Right-click annotation drawing (desktop) ──
  // Ephemeral mode keeps shapes tagged with the position they were drawn on, so
  // they vanish as soon as the position changes. The key is content-based, not
  // `state` identity: online polling re-deserializes an identical state.
  const ephemeralShapes = !!props.drawable && !props.onShapeDraw;
  const positionKey = useMemo(() => {
    if (!ephemeralShapes) return '';
    let k = `${state.moveNumber}|${state.phase}|${state.currentPlayer}|`;
    for (const r of state.rings.values()) k += r.isRemoved ? 'x' : r.marble ? r.marble.color[0] : '.';
    return k;
  }, [ephemeralShapes, state]);
  const [localShapes, setLocalShapes] = useState<{ key: string; shapes: Shape[] }>({ key: '', shapes: [] });
  const shownShapes = ephemeralShapes
    ? (localShapes.key === positionKey ? localShapes.shapes : [])
    : props.shapes;
  const emitShape = (shape: Shape) => {
    if (ephemeralShapes) setLocalShapes({ key: positionKey, shapes: toggleShape(shownShapes, shape) });
    else props.onShapeDraw?.(shape);
  };

  // 🧹 / Esc / Delete: wipe every arrow and circle on the current position.
  const canClearShapes = !!props.drawable && !!shownShapes?.length && (ephemeralShapes || !!props.onClearShapes);
  const clearShapes = () => {
    if (ephemeralShapes) setLocalShapes({ key: positionKey, shapes: [] });
    else props.onClearShapes?.();
  };
  const clearShapesRef = useRef(clearShapes);
  clearShapesRef.current = clearShapes;
  useEffect(() => {
    if (!canClearShapes) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Delete') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      clearShapesRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canClearShapes]);

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
    if (e.button === 0 && ephemeralShapes && shownShapes?.length) {
      setLocalShapes({ key: positionKey, shapes: [] });
      return;
    }
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
    emitShape(dest && dest !== orig ? { orig, dest, brush } : { orig, brush });
  };

  const cancelDraw = () => { drawOriginRef.current = null; setDrawState(null); };

  // Pixel position of any ring id, including removed rings (not in `positions`).
  const pointOf = (id: string): Pt | null => {
    const p = positions.get(id);
    if (p) return p;
    const ring = state.rings.get(id);
    return ring ? hexToPixel(ring.q, ring.r, RING_SPACING) : null;
  };

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
          onContextMenu={props.drawable
            ? (e) => e.preventDefault()
            : props.onRingRightClick
              ? (e) => {
                  e.preventDefault();
                  const loc = toLocal(e.clientX, e.clientY);
                  const ring = loc && ringAtLocal(loc.x, loc.y);
                  if (ring) props.onRingRightClick!(ring);
                }
              : undefined}
          onMouseDown={props.drawable ? handleDrawDown : undefined}
          onMouseMove={props.drawable ? handleDrawMove : undefined}
          onMouseUp={props.drawable ? handleDrawUp : undefined}
          onMouseLeave={props.drawable ? cancelDraw : undefined}
        >
          <MarbleDefs prefix={gradPrefix} />
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
                  marbleAnim={anim?.dest?.id === ring.id ? { key: anim.key, kind: anim.dest.kind, delayMs: anim.dest.delayMs } : null}
                  onClick={props.onRingClick}
                />
              );
            })}

            {/* Move animation overlays: vanishing rings/marbles, flying marble */}
            {anim && (
              <g key={anim.key} style={{ pointerEvents: 'none' }}>
                {anim.vanishRings.map(v => {
                  const p = pointOf(v.id);
                  return p ? (
                    <g key={`vr-${v.id}`} transform={`translate(${p.x}, ${p.y})`}>
                      <circle className="zz-vanish" style={{ animationDelay: `${v.delayMs}ms` }}
                        r={HEX_SIZE * 0.61} fill="none" stroke="#1f1f1f" strokeWidth={HEX_SIZE * 0.48} />
                    </g>
                  ) : null;
                })}
                {anim.vanishMarbles.map(v => {
                  const p = pointOf(v.id);
                  return p ? (
                    <g key={`vm-${v.id}`} transform={`translate(${p.x}, ${p.y})`}>
                      <g className="zz-vanish" style={{ animationDelay: `${v.delayMs}ms` }}>
                        <Marble prefix={gradPrefix} color={v.color} r={HEX_SIZE * 0.58} seed={seedFromId(v.id)} />
                      </g>
                    </g>
                  ) : null;
                })}
                {anim.flight && (
                  <FlyingMarble
                    color={anim.flight.color}
                    hopMs={anim.flight.hopMs}
                    animKey={anim.key}
                    prefix={gradPrefix}
                    points={anim.flight.path.map(id => pointOf(id)).filter((p): p is Pt => !!p)}
                  />
                )}
              </g>
            )}

            {/* Jumps already taken in a half-entered capture chain */}
            {capturePath && capturePath.length > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                {/* Faded ghosts of the marbles captured so far, so it's clear what was taken */}
                {capturePath.map((j, i) => {
                  const c = pointOf(j.captured);
                  const color = j.capturedColor ?? baseState.rings.get(j.captured)?.marble?.color;
                  return c && color ? <CapturedGhost key={`cg-${i}`} p={c} color={color} prefix={gradPrefix} ringId={j.captured} /> : null;
                })}
                <polyline
                  points={[capturePath[0].from, ...capturePath.map(j => j.to)]
                    .map(id => pointOf(id)).filter((p): p is Pt => !!p).map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke={CAPTURE_COLOR} strokeWidth={HEX_SIZE * 0.14} strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={`${HEX_SIZE * 0.3} ${HEX_SIZE * 0.2}`} opacity={0.8}
                />
                {/* Captured-so-far marks, like the last-move highlight's dots */}
                {capturePath.map((j, i) => {
                  const c = pointOf(j.captured);
                  return c ? <circle key={`cp-${i}`} cx={c.x} cy={c.y} r={HEX_SIZE * 0.22} fill={CAPTURE_COLOR} opacity={0.9} /> : null;
                })}
              </g>
            )}

            {/* Last move highlight */}
            {props.lastMove && !capturePath?.length && (
              <g style={{ pointerEvents: 'none' }}>
                <LastMoveMarks move={props.lastMove} pointOf={pointOf} prefix={gradPrefix} fadeTrace={props.fadeLastMoveTrace} />
              </g>
            )}

            {/* Coordinate labels above/below each column */}
            {coordLabels.length > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                {coordLabels.map(l => (
                  <text
                    key={l.key}
                    x={l.x}
                    y={l.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={HEX_SIZE * 0.62}
                    fontWeight={700}
                    fill="#ffffff"
                    opacity={0.85}
                    style={{ userSelect: 'none' }}
                  >
                    {l.text}
                  </text>
                ))}
              </g>
            )}

            {/* Annotation shapes (arrows/circles) + live drawing preview */}
            {(shownShapes?.length || drawState) && (
              <g style={{ pointerEvents: 'none' }}>
                {shownShapes?.map((s, i) => <ShapeMark key={`sh-${i}-${s.orig}-${s.dest ?? ''}`} shape={s} positions={positions} />)}
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
        <div className="absolute top-2 right-2 flex gap-1">
        {canClearShapes && (
          <button
            type="button"
            onClick={clearShapes}
            title={t.boardClearShapes}
            className="px-2 py-1 rounded text-xs bg-black/50 text-white hover:bg-black/60"
          >
            🧹
          </button>
        )}
        {coordsAllowed && (
          <button
            type="button"
            onClick={toggleCoordinates}
            title="Coordinates"
            aria-pressed={showCoordinates}
            className={`px-2 py-1 rounded text-xs font-mono font-bold transition-colors ${
              showCoordinates
                ? 'bg-blue-500 text-white'
                : 'bg-black/50 text-white/80 hover:bg-black/60'
            }`}
          >
            a1
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
