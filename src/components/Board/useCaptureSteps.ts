import { useMemo, useState } from 'react';
import type { CaptureMove } from '../../game/types';
import { captureStepClick, nextCaptureJumps, type CaptureStepResult } from '../../utils/captureSteps';

const NO_PATH: CaptureMove[] = [];

/** Component-local jump-by-jump capture state. The path is bound to the
 *  `chains` array it was built from, so whenever a store resets or recomputes
 *  its `availableCaptureChains` (new selection, move made, navigation, sync) the
 *  half-built path is dropped automatically. */
export function useCaptureSteps(chains: CaptureMove[][]) {
  const [st, setSt] = useState<{ chains: CaptureMove[][]; path: CaptureMove[] }>({ chains, path: NO_PATH });
  const path = st.chains === chains ? st.path : NO_PATH;
  const nextJumps = useMemo(() => nextCaptureJumps(chains, path), [chains, path]);

  const click = (ringId: string): CaptureStepResult => {
    const res = captureStepClick(chains, path, ringId);
    if (res?.kind === 'step') setSt({ chains, path: res.path });
    else if (res?.kind === 'reset' || res?.kind === 'complete') setSt({ chains, path: NO_PATH });
    return res;
  };

  /** Where the capturing marble currently stands (null before the first jump). */
  const position = path.length ? path[path.length - 1].to : null;
  return { path, nextJumps, position, click };
}
