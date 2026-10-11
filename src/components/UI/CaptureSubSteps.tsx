import type { GameNode } from '../../game/types';
import { idToAlgebraic } from '../../game/Board';
import { captureJumps, useCaptureStepView, useStepFor } from '../../store/captureStepView';

interface CaptureSubStepsProps {
  node: GameNode;
  boardSize: 37 | 48 | 61;
  isCurrent: boolean;
  compact?: boolean;
}

// Jump-by-jump chips shown right after the CURRENT multi-jump capture in a move
// list: "›c4 ›e5". Clicking a chip shows the position after that jump; the last
// chip is the move's own final position.
export default function CaptureSubSteps({ node, boardSize, isCurrent, compact }: CaptureSubStepsProps) {
  const viewStep = useStepFor(node);
  const show = useCaptureStepView(s => s.show);
  const jumps = captureJumps(node);
  if (!jumps || !isCurrent) return null;
  const active = viewStep ?? jumps.length;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      {jumps.map((j, i) => {
        const k = i + 1;
        const on = k === active;
        return (
          <span
            key={k}
            onClick={(e) => {
              e.stopPropagation();
              show(node, k < jumps.length ? k : null);
            }}
            className={`cursor-pointer rounded font-mono select-none ${compact ? 'px-0.5 text-[10px]' : 'px-1 text-[11px]'} ${
              on ? 'bg-amber-400 text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title={`${k}/${jumps.length}`}
          >
            ›{idToAlgebraic(j.to, boardSize)}
          </span>
        );
      })}
    </span>
  );
}
