import { useCallback, useEffect, useRef } from 'react';
import { GameNode, PreMoveVariant } from '../../game/types';
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

function renderMoveTree(
  node: GameNode,
  currentNodeId: string,
  onNavigate: (node: GameNode) => void,
  activeRef: React.RefObject<HTMLSpanElement>
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const mainChild = node.children[0];

  if (!mainChild) return elements;

  elements.push(
    <MoveElement
      key={mainChild.id}
      node={mainChild}
      isCurrentMove={mainChild.id === currentNodeId}
      onNavigate={onNavigate}
      activeRef={activeRef}
    />
  );

  const variations = node.children.slice(1);
  for (const variation of variations) {
    elements.push(
      <span key={`var-open-${variation.id}`} className="text-gray-500">
        {' '}
        (
      </span>
    );
    elements.push(
      <MoveElement
        key={variation.id}
        node={variation}
        isCurrentMove={variation.id === currentNodeId}
        onNavigate={onNavigate}
        activeRef={activeRef}
      />
    );
    elements.push(...renderMoveTree(variation, currentNodeId, onNavigate, activeRef));
    elements.push(
      <span key={`var-close-${variation.id}`} className="text-gray-500">
        )
      </span>
    );
  }

  elements.push(...renderMoveTree(mainChild, currentNodeId, onNavigate, activeRef));
  return elements;
}

function renderPremoveVariants(premoves: PreMoveVariant[]): JSX.Element[] {
  if (premoves.length === 0) return [];
  const elements: JSX.Element[] = [];
  for (const v of premoves) {
    elements.push(
      <span key={`pm-open-${v.id}`} className="text-amber-600 dark:text-amber-400 italic">
        {' '}
        (
      </span>
    );
    v.sequence.forEach((step, i) => {
      elements.push(
        <span
          key={`pm-${v.id}-${i}`}
          className="text-amber-700 dark:text-amber-300 italic px-1"
          title="Conditional pre-move"
        >
          {step.notation}
        </span>
      );
    });
    elements.push(
      <span key={`pm-close-${v.id}`} className="text-amber-600 dark:text-amber-400 italic">
        )
      </span>
    );
  }
  return elements;
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
    premoves,
    isAnalyzing,
    analysisGameTree,
    analysisCurrentNode,
    analysisNavigateToNode,
  } = useRoomStore();

  // In analysis mode the widget walks the analysis tree (which includes saved
  // pre-move variants as branches), so the user can click any node freely.
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

  const moves = renderMoveTree(activeTree, activeCurrentNode.id, activeNavigate, activeRef);
  // In analysis mode pre-moves are already merged into the active tree as
  // navigable branches, so don't render them as ghost text again.
  const premoveElements = isAnalyzing ? [] : renderPremoveVariants(premoves);
  const isAtStart = activeCurrentNode.id === activeTree.id;
  // Append a victory marker after the move list when the (live) game has ended.
  // In analysis mode different branches end differently, so don't show.
  const marker = !isAnalyzing ? winMarker(state.winner, winType, t) : null;

  if (moves.length === 0 && premoveElements.length === 0) {
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
      {moves}
      {premoveElements}
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
