import { useEffect, useCallback, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GameNode } from '../../game/types';
import { useI18n } from '../../i18n';
import ConfirmModal from './ConfirmModal';

interface MoveElementProps {
  node: GameNode;
  isCurrentMove: boolean;
  onNavigate: (node: GameNode) => void;
  onRequestDelete: (node: GameNode) => void;
  canDelete: boolean;
  activeRef?: React.RefObject<HTMLSpanElement>;
}

function MoveElement({ node, isCurrentMove, onNavigate, onRequestDelete, canDelete, activeRef }: MoveElementProps) {
  const moveNum = `${node.moveNumber}. `;

  return (
    <span
      ref={isCurrentMove ? activeRef : undefined}
      onClick={() => onNavigate(node)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!canDelete) return;
        onRequestDelete(node);
      }}
      className={`
        cursor-pointer px-1 rounded transition-colors select-none whitespace-nowrap
        ${isCurrentMove
          ? 'bg-blue-500 text-white'
          : 'hover:bg-gray-200 dark:hover:bg-gray-700'}
      `}
    >
      {moveNum}{node.notation}
    </span>
  );
}

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

function renderMoveTree(
  node: GameNode,
  currentNodeId: string,
  onNavigate: (node: GameNode) => void,
  onRequestDelete: (node: GameNode) => void,
  canDeleteNode: (node: GameNode) => boolean,
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
      onRequestDelete={onRequestDelete}
      canDelete={canDeleteNode(mainChild)}
      activeRef={activeRef}
    />
  );

  const variations = node.children.slice(1);
  for (const variation of variations) {
    elements.push(
      <span key={`var-open-${variation.id}`} className="text-gray-500"> (</span>
    );
    elements.push(
      <MoveElement
        key={variation.id}
        node={variation}
        isCurrentMove={variation.id === currentNodeId}
        onNavigate={onNavigate}
        onRequestDelete={onRequestDelete}
        canDelete={canDeleteNode(variation)}
        activeRef={activeRef}
      />
    );
    elements.push(...renderMoveTree(variation, currentNodeId, onNavigate, onRequestDelete, canDeleteNode, activeRef));
    elements.push(
      <span key={`var-close-${variation.id}`} className="text-gray-500">)</span>
    );
  }

  elements.push(...renderMoveTree(mainChild, currentNodeId, onNavigate, onRequestDelete, canDeleteNode, activeRef));

  return elements;
}

export default function MoveHistory() {
  const { t } = useI18n();
  const { state, winType, gameTree, currentNode, navigateToNode, deleteBranchFrom, isLoadedGame } = useGameStore();
  const [pendingDelete, setPendingDelete] = useState<GameNode | null>(null);

  const navigatePrev = useCallback(() => {
    if (currentNode.parent) {
      navigateToNode(currentNode.parent);
    }
  }, [currentNode, navigateToNode]);

  const handleDelete = useCallback((node: GameNode) => {
    if (node.id === 'root') return;
    deleteBranchFrom(node.id);
  }, [deleteBranchFrom]);

  const canDeleteNode = useCallback((node: GameNode) => {
    if (node.id === 'root') return false;
    if (isLoadedGame && node.isMainLine) return false;
    return true;
  }, [isLoadedGame]);
  
  const navigateNext = useCallback(() => {
    if (currentNode.children.length > 0) {
      navigateToNode(currentNode.children[0]);
    }
  }, [currentNode, navigateToNode]);
  
  // Keyboard navigation
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
  }, [currentNode.id]);

  const moves = renderMoveTree(gameTree, currentNode.id, navigateToNode, setPendingDelete, canDeleteNode, activeRef);
  const isAtStart = currentNode.id === 'root';
  const marker = winMarker(state.winner, winType, t);

  if (moves.length === 0) {
    return (
      <div className="p-2 text-gray-500 dark:text-gray-400 text-sm">
        {t.noMovesYet}
      </div>
    );
  }

  return (
    <>
      <div
        className="flex gap-1 overflow-x-auto whitespace-nowrap text-sm font-mono text-gray-800 dark:text-gray-200 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        <span
          ref={isAtStart ? activeRef : undefined}
          onClick={() => navigateToNode(gameTree)}
          className={`cursor-pointer px-1 rounded transition-colors select-none whitespace-nowrap ${isAtStart ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          {`0. ${t.moveStart}`}
        </span>
        {moves}
        {marker && (
          <span
            title={marker.title}
            className="px-1 select-none text-gray-700 dark:text-gray-200 font-bold"
          >
            {marker.symbol}
          </span>
        )}
      </div>
      {pendingDelete && (
        <ConfirmModal
          message={t.deleteMovesConfirm}
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            handleDelete(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}
    </>
  );
}
