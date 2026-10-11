import type { ReactElement } from 'react';
import { GameNode } from '../../game/types';
import { useI18n, type Dict } from '../../i18n';
import CaptureSubSteps from '../UI/CaptureSubSteps';
import MoveGlyphMark from '../UI/MoveGlyphMark';
import { useStepFor } from '../../store/captureStepView';
import { isOnMainLine } from '../../utils/gameTreeUtils';

/** Author-only tree edits. Each control appears on hover, and always on the current move (touch). */
export interface StudyTreeEdit {
  onDelete: (node: GameNode) => void;
  onPromote: (node: GameNode) => void;
  onMoveUp: (node: GameNode) => void;
  onTruncate: (node: GameNode) => void;
}

interface StudyMoveTreeProps {
  root: GameNode;
  currentId: string;
  onSelect: (node: GameNode) => void;
  /** When provided (author editing), moves get variation controls. */
  edit?: StudyTreeEdit;
  boardSize: 37 | 48 | 61;
}

interface LineCtx {
  currentId: string;
  onSelect: (n: GameNode) => void;
  boardSize: 37 | 48 | 61;
  edit?: StudyTreeEdit;
  t: Dict;
}

function MoveChip({ node, currentId, onSelect, boardSize }: { node: GameNode; currentId: string; onSelect: (n: GameNode) => void; boardSize: 37 | 48 | 61 }) {
  const isNode = node.id === currentId;
  // While a jump of this capture is shown, the jump chip is highlighted instead.
  const stepActive = useStepFor(node) != null;
  const isCurrent = isNode && !stepActive;
  return (
    <>
    <span
      onClick={() => onSelect(node)}
      className={`inline-flex items-center gap-1 font-mono text-[12px] leading-snug cursor-pointer rounded px-1.5 py-0.5 ${
        isCurrent
          ? 'bg-indigo-500 text-white'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      <span className={isCurrent ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}>{node.moveNumber}.</span>
      {node.notation}
      <MoveGlyphMark node={node} onDark={isCurrent} />
      {node.comment && <span className="text-[10px] opacity-70" title={node.comment}>💬</span>}
    </span>
    <CaptureSubSteps node={node} boardSize={boardSize} isCurrent={isNode} />
    </>
  );
}

function EditControls({ node, ctx }: { node: GameNode; ctx: LineCtx }) {
  const { edit, t } = ctx;
  if (!edit) return null;
  const isCurrent = node.id === ctx.currentId;
  const index = node.parent ? node.parent.children.indexOf(node) : 0;
  const btn = 'px-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-700';
  return (
    <span className={`ml-1 inline-flex gap-0.5 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
      {!isOnMainLine(node) && (
        <button type="button" className={`${btn} text-indigo-500`} title={t.studyPromoteMainLine} onClick={() => edit.onPromote(node)}>⇧</button>
      )}
      {index > 0 && (
        <button type="button" className={`${btn} text-indigo-500`} title={t.studyMoveVariationUp} onClick={() => edit.onMoveUp(node)}>↑</button>
      )}
      {node.children.length > 0 && (
        <button type="button" className={`${btn} text-orange-500`} title={t.studyTruncateAfter} onClick={() => edit.onTruncate(node)}>✂</button>
      )}
      <button type="button" className={`${btn} text-red-400 hover:text-red-600`} title={t.studyDeleteFromHere} onClick={() => edit.onDelete(node)}>✕</button>
    </span>
  );
}

// Renders the line starting at `node` (inclusive), following the main line
// (children[0]) flat, and emitting each sibling variation as an indented block
// at the branch point. Classic chess-tree layout: main line stays unindented,
// only variations step in.
function renderLine(node: GameNode, depth: number, ctx: LineCtx): ReactElement[] {
  const rows: ReactElement[] = [];
  let cur: GameNode | null = node;
  while (cur && cur.move) {
    const here: GameNode = cur;
    rows.push(
      <div key={here.id} className="group flex items-center" style={{ paddingLeft: depth * 14 }}>
        <MoveChip node={here} currentId={ctx.currentId} onSelect={ctx.onSelect} boardSize={ctx.boardSize} />
        <EditControls node={here} ctx={ctx} />
      </div>
    );
    const kids = here.children.filter(k => k.move);
    for (let i = 1; i < kids.length; i++) {
      rows.push(<div key={`${kids[i].id}-var`}>{renderLine(kids[i], depth + 1, ctx)}</div>);
    }
    cur = kids[0] ?? null;
  }
  return rows;
}

// Navigable variation tree. Root has no move; its children are the first moves
// (children[0] = main line, rest = first-move alternatives).
export default function StudyMoveTree({ root, currentId, onSelect, edit, boardSize }: StudyMoveTreeProps) {
  const { t } = useI18n();
  const first = root.children.filter(k => k.move);
  const startCurrent = currentId === root.id;
  const ctx: LineCtx = { currentId, onSelect, boardSize, edit, t };
  return (
    <div className="flex flex-col gap-0.5">
      {/* Zero move — the starting position; clickable, can hold a comment. */}
      <div>
        <span
          onClick={() => onSelect(root)}
          className={`inline-flex items-center gap-1 text-[12px] leading-snug cursor-pointer rounded px-1.5 py-0.5 ${
            startCurrent ? 'bg-indigo-500 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          ⏮ {t.studyStart}
          {root.comment && <span className="text-[10px] opacity-70" title={root.comment}>💬</span>}
        </span>
      </div>
      {first.length === 0 ? null : (
        <>
          {renderLine(first[0], 0, ctx)}
          {first.slice(1).map(alt => (
            <div key={`${alt.id}-rootvar`} className="border-l border-gray-200 dark:border-gray-700">
              {renderLine(alt, 1, ctx)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
