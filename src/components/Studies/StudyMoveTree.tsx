import type { ReactElement } from 'react';
import { GameNode } from '../../game/types';

interface StudyMoveTreeProps {
  root: GameNode;
  currentId: string;
  onSelect: (node: GameNode) => void;
  /** When provided (author editing), each move shows a ✕ to prune its branch. */
  onDelete?: (node: GameNode) => void;
}

function MoveChip({ node, currentId, onSelect }: { node: GameNode; currentId: string; onSelect: (n: GameNode) => void }) {
  const isCurrent = node.id === currentId;
  return (
    <span
      onClick={() => onSelect(node)}
      className={`inline-flex items-center gap-1 font-mono text-[12px] leading-snug cursor-pointer rounded px-1.5 py-0.5 ${
        isCurrent
          ? 'bg-indigo-500 text-white'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {node.notation}
      {node.comment && <span className="text-[10px] opacity-70" title={node.comment}>💬</span>}
    </span>
  );
}

// Renders the line starting at `node` (inclusive), following the main line
// (children[0]) flat, and emitting each sibling variation as an indented block
// at the branch point. Classic chess-tree layout: main line stays unindented,
// only variations step in.
function renderLine(
  node: GameNode,
  depth: number,
  currentId: string,
  onSelect: (n: GameNode) => void,
  onDelete?: (n: GameNode) => void,
): ReactElement[] {
  const rows: ReactElement[] = [];
  let cur: GameNode | null = node;
  while (cur && cur.move) {
    const here: GameNode = cur;
    rows.push(
      <div key={here.id} className="group flex items-center" style={{ paddingLeft: depth * 14 }}>
        <MoveChip node={here} currentId={currentId} onSelect={onSelect} />
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(here)}
            className="ml-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 text-xs"
            title="✕"
          >
            ✕
          </button>
        )}
      </div>
    );
    const kids = here.children.filter(k => k.move);
    for (let i = 1; i < kids.length; i++) {
      rows.push(<div key={`${kids[i].id}-var`}>{renderLine(kids[i], depth + 1, currentId, onSelect, onDelete)}</div>);
    }
    cur = kids[0] ?? null;
  }
  return rows;
}

// Navigable variation tree. Root has no move; its children are the first moves
// (children[0] = main line, rest = first-move alternatives).
export default function StudyMoveTree({ root, currentId, onSelect, onDelete }: StudyMoveTreeProps) {
  const first = root.children.filter(k => k.move);
  if (first.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-2">—</p>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {renderLine(first[0], 0, currentId, onSelect, onDelete)}
      {first.slice(1).map(alt => (
        <div key={`${alt.id}-rootvar`} className="border-l border-gray-200 dark:border-gray-700">
          {renderLine(alt, 1, currentId, onSelect, onDelete)}
        </div>
      ))}
    </div>
  );
}
