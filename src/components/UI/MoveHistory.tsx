import { useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { GameNode } from '../../game/types';

interface MoveElementProps {
  node: GameNode;
  isCurrentMove: boolean;
  onNavigate: (node: GameNode) => void;
}

function MoveElement({ node, isCurrentMove, onNavigate }: MoveElementProps) {
  // Number format: "1." for both players, no ellipsis
  const moveNum = `${node.moveNumber}. `;
  
  return (
    <span
      onClick={() => onNavigate(node)}
      className={`
        cursor-pointer px-1 rounded transition-colors select-none
        ${isCurrentMove 
          ? 'bg-blue-500 text-white' 
          : 'hover:bg-gray-200 dark:hover:bg-gray-700'}
      `}
    >
      {moveNum}{node.notation}
    </span>
  );
}

function renderMoveTree(
  node: GameNode,
  currentNodeId: string,
  onNavigate: (node: GameNode) => void
): JSX.Element[] {
  // We treat node.children[0] as the main line, and node.children[1..] as variations.
  // Rendering rule: show sibling variations in parentheses immediately after the parent,
  // then show the main move, then continue along the main line.
  const elements: JSX.Element[] = [];

  const mainChild = node.children[0];
  if (!mainChild) return elements;

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
      />
    );
    elements.push(...renderMoveTree(variation, currentNodeId, onNavigate));
    elements.push(
      <span key={`var-close-${variation.id}`} className="text-gray-500">)</span>
    );
  }

  elements.push(
    <MoveElement
      key={mainChild.id}
      node={mainChild}
      isCurrentMove={mainChild.id === currentNodeId}
      onNavigate={onNavigate}
    />
  );

  // Continue main line
  elements.push(...renderMoveTree(mainChild, currentNodeId, onNavigate));

  return elements;
}

export default function MoveHistory() {
  const { gameTree, currentNode, navigateToNode } = useGameStore();
  
  const navigatePrev = useCallback(() => {
    if (currentNode.parent && currentNode.parent.id !== 'root') {
      navigateToNode(currentNode.parent);
    }
  }, [currentNode, navigateToNode]);
  
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
  
  const moves = renderMoveTree(gameTree, currentNode.id, navigateToNode);
  
  if (moves.length === 0) {
    return (
      <div className="p-2 text-gray-500 dark:text-gray-400 text-sm">
        Ходов пока нет
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-1 text-sm font-mono text-gray-800 dark:text-gray-200">
      {moves}
    </div>
  );
}
