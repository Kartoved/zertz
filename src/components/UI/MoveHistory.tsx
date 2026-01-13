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
  onNavigate: (node: GameNode) => void,
  depth: number = 0
): JSX.Element[] {
  const elements: JSX.Element[] = [];
  
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const isCurrentMove = child.id === currentNodeId;
    const isVariation = i > 0;
    
    if (isVariation) {
      elements.push(
        <span key={`var-open-${child.id}`} className="text-gray-500"> (</span>
      );
    }
    
    elements.push(
      <MoveElement 
        key={child.id}
        node={child}
        isCurrentMove={isCurrentMove}
        onNavigate={onNavigate}
      />
    );
    
    elements.push(...renderMoveTree(child, currentNodeId, onNavigate, depth + 1));
    
    if (isVariation) {
      elements.push(
        <span key={`var-close-${child.id}`} className="text-gray-500">)</span>
      );
    }
  }
  
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
