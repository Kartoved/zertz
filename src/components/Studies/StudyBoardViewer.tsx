import { useState, useEffect, useMemo } from 'react';
import HexBoard from '../Board/HexBoard';
import StudyMoveTree from './StudyMoveTree';
import { StudyNode } from '../../db/studiesApi';
import { deserializeTree } from '../../db/apiClient';
import { findDeepestMainLine } from '../../utils/gameTreeUtils';
import { studyStateAtNode, findNodeById } from './studyState';
import { useI18n } from '../../i18n';

// Etap C1 — read-only viewer: shows the board position at the selected node and
// a navigable variation tree. Interactive move entry (ephemeral for readers,
// saved for authors) comes in C2/E.
export default function StudyBoardViewer({ study }: { study: StudyNode }) {
  const { t } = useI18n();
  const root = useMemo(() => deserializeTree(study.treeJson), [study.treeJson]);
  const [currentId, setCurrentId] = useState('root');

  // Reset to the start when a different study opens.
  useEffect(() => { setCurrentId('root'); }, [study.id]);

  const currentNode = useMemo(() => findNodeById(root, currentId) ?? root, [root, currentId]);
  const boardState = useMemo(() => studyStateAtNode(study.setupJson, currentNode), [study.setupJson, currentNode]);

  const goFirst = () => setCurrentId('root');
  const goPrev = () => { if (currentNode.parent) setCurrentId(currentNode.parent.id); };
  const goNext = () => { if (currentNode.children[0]) setCurrentId(currentNode.children[0].id); };
  const goLast = () => setCurrentId(findDeepestMainLine(root).id);

  const NavBtn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-default"
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 mt-4">
      {/* Board */}
      <div className="flex-1 min-w-0">
        <div className="w-full max-w-[520px] mx-auto aspect-square rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <HexBoard state={boardState} preview />
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
          <NavBtn onClick={goFirst} disabled={currentId === 'root'}>⏮</NavBtn>
          <NavBtn onClick={goPrev} disabled={!currentNode.parent}>◀</NavBtn>
          <NavBtn onClick={goNext} disabled={!currentNode.children[0]}>▶</NavBtn>
          <NavBtn onClick={goLast}>⏭</NavBtn>
        </div>
      </div>

      {/* Notation panel + node comment */}
      <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 max-h-[360px] overflow-y-auto">
          <StudyMoveTree root={root} currentId={currentId} onSelect={n => setCurrentId(n.id)} />
        </div>
        {currentNode.comment && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
            {currentNode.comment}
          </div>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1">{t.studyReadOnlyHint}</p>
      </div>
    </div>
  );
}
