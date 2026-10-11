import type { Shape } from './types';

/** Toggle a drawn annotation: the same orig+dest in the same colour removes it,
 *  a different colour recolours it, otherwise it's added. Returns a new array. */
export function toggleShape(shapes: readonly Shape[] | undefined, shape: Shape): Shape[] {
  const list = shapes ? [...shapes] : [];
  const idx = list.findIndex(s => s.orig === shape.orig && s.dest === shape.dest);
  if (idx >= 0) {
    if (list[idx].brush === shape.brush) list.splice(idx, 1);
    else list[idx] = shape;
  } else {
    list.push(shape);
  }
  return list;
}
