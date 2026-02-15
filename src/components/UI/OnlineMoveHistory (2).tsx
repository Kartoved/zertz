import { useCallback, useEffect } from 'react';
import { GameNode } from '../../game/types';
import { useRoomStore } from '../../store/roomStore';
import { useI18n } from '../../i18n';

interface MoveElementProps {
  node: GameNode;
  isCurrentMove: boolean;
  onNavigate: (node: GameNode) => void;
}

function MoveElement({ node, isCurrentMove, onNavigate }: MoveElementProps) {
  const moveNum = `${node.moveNumber}. `;

  return (
    <span
      onClick={() => onNavigate(node)}
      className={`
        cursor-pointer px-1 rounded transition-colors select-none
        ${isCurrentMove ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}
      `}
    >
      {moveNum}
      {node.notation}
    </span>
  );
}

function renderMoveTree(node: GameNode, currentNodeId: string, onNavigate: (node: GameNode) => void): JSX.Element[] {
  const elements: JSX.Element[] = [];
  const mainChild = node.children[0];

  if (!mainChild) return elements;

  elements.push(
    <MoveElement
      key={mainChild.id}
      node={mainChild}
      isCurrentMove={mainChild.id === currentNodeId}
      onNavigate={onNavigate}
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
      />
    );
    elements.push(...renderMoveTree(variation, currentNodeId, onNavigate));
    elements.push(
      <span key={`var-close-${variation.id}`} className="text-gray-500">
        )
      </span>
    );
  }

  elements.push(...renderMoveTree(mainChild, currentNodeId, onNavigate));
  return elements;
}

export default function OnlineMoveHistory() {
  const { t } = useI18n();
  const { gameTree, currentNode, navigateToNode } = useRoomStore();

  const navigatePrev = useCallback(() => {
    if (currentNode.parent) {
      navigateToNode(currentNode.parent);
    }
  }, [currentNode, navigateToNode]);

  const navigateNext = useCallback(() => {
    if (currentNode.children.length > 0) {
      navigateToNode(currentNode.children[0]);
    }
  }, [currentNode, navigateToNode]);

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

  const moves = renderMoveTree(gameTree, currentNode.id, navigateToNode);
  const isAtStart = currentNode.id === 'root';

  if (moves.length === 0) {
    return <div className="p-1 text-xs text-gray-500 dark:text-gray-400">{t.noMovesYet}</div>;
  }

  return (
    <div className="flex flex-wrap gap-1 text-xs md:text-sm font-mono text-gray-800 dark:text-gray-200">
      <span
        onClick={() => navigateToNode(gameTree)}
        className={`cursor-pointer px-1 rounded transition-colors select-none ${isAtStart ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
      >
        {`0. ${t.moveStart}`}
      </span>
      {moves}
    </div>
  );
}
