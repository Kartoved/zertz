import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

// Robust "click to open" for live-updating preview cards (current games, ZERTZ TV).
//
// These targets wrap a `<HexBoard preview>` that re-renders on polling, and the
// card itself can shift/shrink between press and release. The browser's native
// `click` only fires when the mousedown and mouseup share a common ancestor with
// the handler — so if the element under the pointer changes in that window the
// click is silently dropped ("nothing happens on left-click, works on 2nd try").
//
// Firing on `pointerup` with a small movement threshold sidesteps that: it acts
// on whatever element is under the pointer at release, and still ignores drags
// and scroll gestures.
export function usePressToActivate(onActivate: () => void, threshold = 10) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0) return; // primary button only
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (dx * dx + dy * dy <= threshold * threshold) onActivate();
    },
    onPointerCancel: () => { start.current = null; },
  };
}
