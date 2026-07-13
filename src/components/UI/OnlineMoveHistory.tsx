import { useCallback, useEffect, useRef } from 'react';
import { GameNode } from '../../game/types';
import { useRoomStore } from '../../store/roomStore';
import { useI18n } from '../../i18n';

interface MoveElementProps {
  node: GameNode;
  isCurrentMove: boolean;
  onNavigate: (node: GameNode) => void;
  activeRef?: React.RefObject<HTMLSpanElement>;
}

function MoveElement({ node, isCurrentMove, onNavigate, activeRef }: MoveElementProps) {
  const moveNum = `${node.moveNumber}. `;

  return (
    <span
      ref={isCurrentMove ? activeRef : undefined}
      onClick={() => onNavigate(node)}
      className={`
        cursor-pointer px-1 rounded transition-colors select-none whitespace-nowrap
        ${isCurrentMove ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}
      `}
    >
      {moveNum}
      {node.notation}
    </span>
  );
}

// The single linear line that runs THROUGH `current`: its ancestors (root →
// current) followed by the main-line continuation after it (children[0] chain).
// Branches are not shown here — they live in the navigable tree in the Plan tab.
// This keeps the top strip a clean, readable line even deep in analysis.
function lineThroughNode(current: GameNode): GameNode[] {
  const up: GameNode[] = [];
  let n: GameNode | null = current;
  while (n) {
    up.unshift(n);
    n = n.parent;
  }
  const down: GameNode[] = [];
  let m: GameNode | undefined = current.children[0];
  while (m) {
    down.push(m);
    m = m.children[0];
  }
  return [...up, ...down]; // up[0] is the root (move === null)
}

// Compact symbol summarising how the game ended. Title carries the long form.
function winMarker(winner: string | null | undefined, winType: string | null | undefined, t: ReturnType<typeof useI18n>['t']): { symbol: string; title: string } | null {
  if (!winner) return null;
  if (winner === 'cancelled') return { symbol: '✕', title: t.cancelledStatus };
  if (winType === 'white') return { symbol: '⚪', title: t.winByWhite };
  if (winType === 'gray') return { symbol: '🔘', title: t.winByGray };
  if (winType === 'black') return { symbol: '⚫', title: t.winByBlack };
  if (winType === 'mixed') return { symbol: '🎨', title: t.winByMixed };
  if (winType === 'time') return { symbol: '⏱', title: t.winByTime };
  if (winType === 'surrender') return { symbol: '🏳', title: t.surrender };
  return { symbol: '★', title: t.gameOver || '' };
}

export default function OnlineMoveHistory() {
  const { t } = useI18n();
  const {
    state,
    winType,
    gameTree,
    currentNode,
    navigateToNode,
    isAnalyzing,
    analysisGameTree,
    analysisCurrentNode,
    analysisNavigateToNode,
  } = useRoomStore();

  // In analysis the strip shows the line through the position you're viewing;
  // in the live game it's the game's main line (currentNode is its tip).
  const activeTree = isAnalyzing && analysisGameTree ? analysisGameTree : gameTree;
  const activeCurrentNode = isAnalyzing && analysisCurrentNode ? analysisCurrentNode : currentNode;
  const activeNavigate = isAnalyzing ? analysisNavigateToNode : navigateToNode;

  const navigatePrev = useCallback(() => {
    if (activeCurrentNode.parent) {
      activeNavigate(activeCurrentNode.parent);
    }
  }, [activeCurrentNode, activeNavigate]);

  const navigateNext = useCallback(() => {
    if (activeCurrentNode.children.length > 0) {
      activeNavigate(activeCurrentNode.children[0]);
    }
  }, [activeCurrentNode, activeNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        navigatePrev();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigatePrev, navigateNext]);

  const activeRef = useRef<HTMLSpanElement>(null);
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    const behavior: ScrollBehavior = didInitialScrollRef.current ? 'smooth' : 'auto';
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior });
    didInitialScrollRef.current = true;
  }, [activeCurrentNode.id]);

  // Skip the root (move === null); it's rendered as the "0. start" crumb.
  const lineMoves = lineThroughNode(activeCurrentNode).filter(n => n.move);
  const isAtStart = activeCurrentNode.id === activeTree.id;
  // Append a victory marker after the move list when the (live) game has ended.
  // In analysis different branches end differently, so don't show.
  const marker = !isAnalyzing ? winMarker(state.winner, winType, t) : null;

  if (lineMoves.length === 0) {
    return <div className="p-1 text-xs text-gray-500 dark:text-gray-400">{t.noMovesYet}</div>;
  }

  return (
    <div
      className="flex gap-1 overflow-x-auto whitespace-nowrap text-xs md:text-sm font-mono text-gray-800 dark:text-gray-200 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      <span
        ref={isAtStart ? activeRef : undefined}
        onClick={() => activeNavigate(activeTree)}
        className={`cursor-pointer px-1 rounded transition-colors select-none whitespace-nowrap ${isAtStart ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
      >
        {`0. ${t.moveStart}`}
      </span>
      {lineMoves.map(node => (
        <MoveElement
          key={node.id}
          node={node}
          isCurrentMove={node.id === activeCurrentNode.id}
          onNavigate={activeNavigate}
          activeRef={activeRef}
        />
      ))}
      {marker && (
        <span
          title={marker.title}
          className="px-1 select-none text-gray-700 dark:text-gray-200 font-bold"
        >
          {marker.symbol}
        </span>
      )}
    </div>
  );
}
