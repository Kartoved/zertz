import type { GameNode } from '../../game/types';
import { GLYPH_COLOR } from '../../game/glyphs';

/** The `!`, `??`… mark after a move in a move list (nothing if the move has none). */
export default function MoveGlyphMark({ node, onDark }: { node: GameNode; onDark?: boolean }) {
  if (!node.glyph) return null;
  return (
    <span className="font-bold" style={{ color: onDark ? undefined : GLYPH_COLOR[node.glyph] }}>
      {node.glyph}
    </span>
  );
}
