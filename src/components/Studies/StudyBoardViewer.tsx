import { useState, useEffect, useRef } from 'react';
import HexBoard from '../Board/HexBoard';
import MarbleSelector from '../UI/MarbleSelector';
import StudyMoveTree from './StudyMoveTree';
import { StudyNode } from '../../db/studiesApi';
import { deserializeTree, serializeTree } from '../../db/apiClient';
import { findDeepestMainLine } from '../../utils/gameTreeUtils';
import { getValidRemovableRings } from '../../game/Board';
import {
  computeAnalysisRingSelection,
  applyAnalysisPlacement,
  applyAnalysisRingRemoval,
  applyAnalysisCapture,
} from '../../store/analysisActions';
import { studyStateAtNode, findNodeById } from './studyState';
import { GameNode, GameState, MarbleColor, CaptureMove, Captures, WIN_CONDITIONS } from '../../game/types';
import { useI18n } from '../../i18n';

const MARBLE_BG: Record<MarbleColor, string> = {
  white: 'bg-white border border-gray-300',
  gray: 'bg-gray-400',
  black: 'bg-gray-700',
};

// One player's captured-marble tally, highlighting any color that reached its
// win threshold.
function CapturesCard({ label, caps, active }: { label: string; caps: Captures; active: boolean }) {
  const cell = (color: MarbleColor, n: number, win: number) => (
    <span className="flex items-center gap-1">
      <span className={`w-3.5 h-3.5 rounded-full shadow-sm ${MARBLE_BG[color]}`} />
      <span className={`text-xs ${n >= win ? 'text-green-500 font-bold' : 'text-gray-700 dark:text-gray-200'}`}>{n}</span>
    </span>
  );
  return (
    <div className={`flex-1 min-w-0 rounded-lg px-2.5 py-1.5 border ${active ? 'ring-2 ring-indigo-400 border-transparent bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
      <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 truncate">{label}</div>
      <div className="flex gap-2.5 mt-0.5">
        {cell('white', caps.white, WIN_CONDITIONS.white)}
        {cell('gray', caps.gray, WIN_CONDITIONS.gray)}
        {cell('black', caps.black, WIN_CONDITIONS.black)}
      </div>
    </div>
  );
}

// Etap C2 — interactive viewer. The reader plays variations on the board; moves
// branch into a LOCAL working copy of the study tree (deserialized fresh, never
// the study prop) and are NOT persisted. "Back to author's line" discards the
// exploration. The same interaction will power author editing (Etap E, + save).
export default function StudyBoardViewer({ study, onSaveTree }: { study: StudyNode; onSaveTree: (treeJson: string) => Promise<void> }) {
  const { t } = useI18n();
  const canEdit = study.isOwner;

  // Working tree: private, mutable, discardable. Re-init on study change.
  const rootRef = useRef<GameNode>(deserializeTree(study.treeJson));
  const [currentNode, setCurrentNode] = useState<GameNode>(rootRef.current);
  const [boardState, setBoardState] = useState<GameState>(() => studyStateAtNode(study.setupJson, rootRef.current));
  const [saving, setSaving] = useState(false);

  // Guards the reinit effect: after our own save we bump these so the incoming
  // treeJson prop change doesn't reset the board to root.
  const lastStudyIdRef = useRef(study.id);
  const lastTreeJsonRef = useRef(study.treeJson);

  // Selection / input state.
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const [highlightedCaptures, setHighlightedCaptures] = useState<CaptureMove[]>([]);
  const [availableChains, setAvailableChains] = useState<CaptureMove[][]>([]);
  const [selectedMarble, setSelectedMarble] = useState<MarbleColor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [, force] = useState(0); // bump to reflect in-place tree mutations

  const clearSelection = () => { setSelectedRingId(null); setHighlightedCaptures([]); setAvailableChains([]); };

  const reinit = (treeJson: string) => {
    const fresh = deserializeTree(treeJson);
    rootRef.current = fresh;
    setCurrentNode(fresh);
    setBoardState(studyStateAtNode(study.setupJson, fresh));
    setSelectedMarble(null);
    clearSelection();
    setDirty(false);
  };

  useEffect(() => {
    // Skip when the change is our own save (same study, treeJson we just wrote).
    if (study.id === lastStudyIdRef.current && study.treeJson === lastTreeJsonRef.current) return;
    lastStudyIdRef.current = study.id;
    lastTreeJsonRef.current = study.treeJson;
    reinit(study.treeJson);
    /* eslint-disable-next-line */
  }, [study.id, study.treeJson]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const treeJson = serializeTree(rootRef.current);
      lastTreeJsonRef.current = treeJson; // pre-empt the reinit from our own write
      await onSaveTree(treeJson);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBranch = (node: GameNode) => {
    const parent = node.parent;
    if (!parent) return;
    // If the viewed node lives inside the pruned subtree, retreat to the parent.
    if (findNodeById(node, currentNode.id)) navigateTo(parent);
    parent.children = parent.children.filter(c => c !== node);
    setDirty(true);
    force(v => v + 1);
  };

  const navigateTo = (node: GameNode) => {
    setCurrentNode(node);
    setBoardState(studyStateAtNode(study.setupJson, node));
    setSelectedMarble(null);
    clearSelection();
  };

  const selectRing = (ringId: string) => {
    const slice = computeAnalysisRingSelection(boardState, ringId);
    if (!slice) return;
    setSelectedRingId(slice.selectedRingId);
    setHighlightedCaptures(slice.highlightedCaptures);
    setAvailableChains(slice.availableCaptureChains ?? []);
  };

  const validRemovableRings = boardState.phase === 'ringRemoval'
    ? getValidRemovableRings(boardState.rings)
    : [];

  const handleRingClick = (ringId: string) => {
    if (boardState.winner) return;
    const ring = boardState.rings.get(ringId);
    if (!ring || ring.isRemoved) return;

    if (boardState.phase === 'ringRemoval') {
      if (!validRemovableRings.includes(ringId)) return;
      const res = applyAnalysisRingRemoval(boardState, currentNode, ringId);
      if (!res) return;
      setBoardState(res.analysisState);
      clearSelection();
      setDirty(true);
      force(v => v + 1);
    } else if (boardState.phase === 'capture') {
      if (selectedRingId) {
        const chain = availableChains.find(c => c[c.length - 1].to === ringId);
        if (chain) {
          const res = applyAnalysisCapture(boardState, currentNode, chain);
          setBoardState(res.analysisState);
          if (res.analysisCurrentNode) setCurrentNode(res.analysisCurrentNode);
          clearSelection();
          setDirty(true);
          return;
        }
      }
      if (ring.marble) selectRing(ringId);
    } else if (boardState.phase === 'placement') {
      if (!ring.marble && selectedMarble) {
        const res = applyAnalysisPlacement(boardState, currentNode, ringId, selectedMarble);
        if (!res) return;
        setBoardState(res.analysisState);
        if (res.analysisCurrentNode) setCurrentNode(res.analysisCurrentNode);
        setSelectedMarble(null);
        clearSelection();
        setDirty(true);
      } else if (!ring.marble) {
        selectRing(ringId);
      }
    }
  };

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

  const phaseLabel = boardState.winner
    ? '🏆'
    : boardState.phase === 'placement' ? t.phasePlacement
    : boardState.phase === 'ringRemoval' ? t.phaseRingRemoval
    : boardState.phase === 'capture' ? t.phaseCapture : '';

  return (
    <div className="flex flex-col lg:flex-row gap-4 mt-4">
      {/* Board */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2 max-w-[520px] mx-auto">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{phaseLabel}</span>
          {dirty && (
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="text-xs font-semibold px-2 py-1 rounded-md bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
                >
                  💾 {t.studySave}
                </button>
              )}
              <button
                type="button"
                onClick={() => reinit(study.treeJson)}
                className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60"
              >
                ↩ {canEdit ? t.studyDiscardChanges : t.studyResetLine}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-stretch gap-2 mb-2 max-w-[520px] mx-auto">
          <CapturesCard
            label={study.meta?.players?.white || t.studyPlayer1}
            caps={boardState.captures.player1}
            active={boardState.currentPlayer === 'player1'}
          />
          <CapturesCard
            label={study.meta?.players?.black || t.studyPlayer2}
            caps={boardState.captures.player2}
            active={boardState.currentPlayer === 'player2'}
          />
        </div>
        <div className="w-full max-w-[520px] mx-auto aspect-square rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <HexBoard
            state={boardState}
            selectedRingId={selectedRingId}
            highlightedCaptures={highlightedCaptures}
            validRemovableRings={validRemovableRings}
            onRingClick={handleRingClick}
            preview
          />
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
          <NavBtn onClick={() => navigateTo(rootRef.current)} disabled={currentNode === rootRef.current}>⏮</NavBtn>
          <NavBtn onClick={() => currentNode.parent && navigateTo(currentNode.parent)} disabled={!currentNode.parent}>◀</NavBtn>
          <NavBtn onClick={() => currentNode.children[0] && navigateTo(currentNode.children[0])} disabled={!currentNode.children[0]}>▶</NavBtn>
          <NavBtn onClick={() => navigateTo(findDeepestMainLine(rootRef.current))}>⏭</NavBtn>
        </div>

        {/* Marble picker (placement phase) */}
        {boardState.phase === 'placement' && !boardState.winner && (
          <div className="max-w-[520px] mx-auto mt-3">
            <MarbleSelector
              reserve={boardState.reserve}
              selectedColor={selectedMarble}
              onSelect={setSelectedMarble}
              phase={boardState.phase}
              currentPlayer={boardState.currentPlayer}
              captures={boardState.captures[boardState.currentPlayer]}
              stateForCaptures={boardState}
            />
          </div>
        )}
      </div>

      {/* Notation panel + node comment */}
      <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 max-h-[360px] overflow-y-auto">
          <StudyMoveTree root={rootRef.current} currentId={currentNode.id} onSelect={navigateTo} onDelete={canEdit ? handleDeleteBranch : undefined} />
        </div>
        {currentNode.comment && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
            {currentNode.comment}
          </div>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1">{canEdit ? t.studyEditHint : t.studyExploreHint}</p>
      </div>
    </div>
  );
}
