import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import HexBoard from '../Board/HexBoard';
import MarbleSelector from '../UI/MarbleSelector';
import StudyMoveTree from './StudyMoveTree';
import { StudyNode } from '../../db/studiesApi';
import { deserializeTree, serializeTree, deserializeState } from '../../db/apiClient';
import { findDeepestMainLine } from '../../utils/gameTreeUtils';
import { getValidRemovableRings } from '../../game/Board';
import { stateToZip } from '../../game/zip';
import { treeToZen } from '../../game/zen';
import NotationButtons from '../UI/NotationButtons';
import ConfirmModal from './ConfirmModal';
import {
  computeAnalysisRingSelection,
  applyAnalysisPlacement,
  applyAnalysisRingRemoval,
  applyAnalysisCapture,
  pickCaptureChain,
} from '../../store/analysisActions';
import { studyStateAtNode, findNodeById } from './studyState';
import { GameNode, GameState, MarbleColor, CaptureMove, Captures, WIN_CONDITIONS, Shape } from '../../game/types';
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
const TRAINING_KEY = 'zertz_study_training:';

// Effective training state for a study: the reader's per-study localStorage
// override wins; otherwise the author default from meta.training.
function readTraining(study: StudyNode): boolean {
  const ls = typeof localStorage !== 'undefined' ? localStorage.getItem(`${TRAINING_KEY}${study.id}`) : null;
  if (ls === '1') return true;
  if (ls === '0') return false;
  return study.meta?.training ?? false;
}

export default function StudyBoardViewer({ study, onSaveTree }: { study: StudyNode; onSaveTree: (treeJson: string) => Promise<void> }) {
  const { t } = useI18n();
  const canEdit = study.isOwner;

  // Working tree: private, mutable, discardable. Re-init on study change.
  const rootRef = useRef<GameNode>(deserializeTree(study.treeJson));
  const [currentNode, setCurrentNode] = useState<GameNode>(rootRef.current);
  const [boardState, setBoardState] = useState<GameState>(() => studyStateAtNode(study.setupJson, rootRef.current));
  const [saving, setSaving] = useState(false);
  const [deleteBranchNode, setDeleteBranchNode] = useState<GameNode | null>(null);

  // Training mode: hide the whole solution (move tree, comments, arrows, forward
  // nav) so the learner explores freely without spoilers. Effective value =
  // per-study localStorage override, else the author default (meta.training).
  // Computed synchronously so training applies on the first render (no flash).
  const [training, setTraining] = useState<boolean>(() => readTraining(study));
  useEffect(() => { setTraining(readTraining(study)); }, [study.id, study.meta?.training]);
  const toggleTraining = () => {
    setTraining(v => {
      const next = !v;
      try { localStorage.setItem(`${TRAINING_KEY}${study.id}`, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

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
  const [commentMode, setCommentMode] = useState<'edit' | 'read'>('edit');
  const [, setChangeSeq] = useState(0); // rerender on in-place tree mutations
  const changeSeqRef = useRef(0);       // latest edit id, for save-race detection

  const clearSelection = () => { setSelectedRingId(null); setHighlightedCaptures([]); setAvailableChains([]); };

  // Marks an in-place tree edit: rerender + flag dirty (drives autosave).
  const markEdited = () => { changeSeqRef.current++; setChangeSeq(changeSeqRef.current); setDirty(true); };

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
    const seqAtStart = changeSeqRef.current;
    try {
      const treeJson = serializeTree(rootRef.current);
      lastTreeJsonRef.current = treeJson; // pre-empt the reinit from our own write
      await onSaveTree(treeJson);
      // Keep dirty if the author edited again while the save was in flight.
      if (changeSeqRef.current === seqAtStart) setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  // Autosave (owner only): debounced, and never mid-move (a placement still
  // owing a ring removal would persist a half-finished node).
  useEffect(() => {
    if (!canEdit || !dirty || saving) return;
    if (boardState.phase === 'ringRemoval') return;
    const id = setTimeout(() => { handleSave(); }, 1200);
    return () => clearTimeout(id);
    /* eslint-disable-next-line */
  }, [changeSeqRef.current, dirty, saving, canEdit, boardState.phase]);

  const handleDeleteBranch = (node: GameNode) => {
    if (node.parent) setDeleteBranchNode(node);
  };

  const confirmDeleteBranch = () => {
    const node = deleteBranchNode;
    setDeleteBranchNode(null);
    const parent = node?.parent;
    if (!node || !parent) return;
    // If the viewed node lives inside the pruned subtree, retreat to the parent.
    if (findNodeById(node, currentNode.id)) navigateTo(parent);
    parent.children = parent.children.filter(c => c !== node);
    markEdited();
  };

  const navigateTo = (node: GameNode) => {
    setCurrentNode(node);
    setBoardState(studyStateAtNode(study.setupJson, node));
    setSelectedMarble(null);
    clearSelection();
  };

  // Keyboard navigation: ←/→ step through the line, Home/End jump to the ends.
  // Ignored while typing in the comment editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
      if (e.key === 'ArrowLeft') { if (currentNode.parent) navigateTo(currentNode.parent); }
      // Forward navigation is disabled in training — it would reveal the solution.
      else if (e.key === 'ArrowRight') { if (!training && currentNode.children[0]) navigateTo(currentNode.children[0]); }
      else if (e.key === 'Home') navigateTo(rootRef.current);
      else if (e.key === 'End') { if (!training) navigateTo(findDeepestMainLine(rootRef.current)); }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    /* eslint-disable-next-line */
  }, [currentNode, training]);

  const updateComment = (value: string) => {
    currentNode.comment = value || undefined;
    markEdited();
  };

  // Toggle a drawn shape on the current node: same orig+dest with same colour
  // removes it, a different colour recolours it, otherwise it's added.
  const handleDrawShape = (shape: Shape) => {
    const list = currentNode.shapes ? [...currentNode.shapes] : [];
    const idx = list.findIndex(s => s.orig === shape.orig && s.dest === shape.dest);
    if (idx >= 0) {
      if (list[idx].brush === shape.brush) list.splice(idx, 1);
      else list[idx] = shape;
    } else {
      list.push(shape);
    }
    currentNode.shapes = list.length ? list : undefined;
    markEdited();
  };

  const clearShapes = () => {
    if (!currentNode.shapes?.length) return;
    currentNode.shapes = undefined;
    markEdited();
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
      markEdited();
    } else if (boardState.phase === 'capture') {
      if (selectedRingId) {
        const chain = pickCaptureChain(availableChains, ringId, currentNode);
        if (chain) {
          const res = applyAnalysisCapture(boardState, currentNode, chain);
          setBoardState(res.analysisState);
          if (res.analysisCurrentNode) setCurrentNode(res.analysisCurrentNode);
          clearSelection();
          markEdited();
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
        markEdited();
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

  const getZip = () => stateToZip(boardState);
  const getZen = () => {
    const players = study.meta?.players;
    return treeToZen(deserializeState(study.setupJson), rootRef.current, {
      Event: study.title || 'Study',
      ...(players?.white ? { Player1: players.white } : {}),
      ...(players?.black ? { Player2: players.black } : {}),
      Result: '*',
    });
  };

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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{phaseLabel}</span>
            <button
              type="button"
              onClick={toggleTraining}
              title={t.studyTraining}
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                training
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {training ? `🙈 ${t.studyTrainingHidden}` : `🎯 ${t.studyTraining}`}
            </button>
          </div>
          {canEdit ? (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {saving || dirty ? `💾 ${t.studySaving}` : `✓ ${t.studySaved}`}
            </span>
          ) : dirty ? (
            <button
              type="button"
              onClick={() => reinit(study.treeJson)}
              className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60"
            >
              ↩ {t.studyResetLine}
            </button>
          ) : null}
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
            shapes={training ? undefined : currentNode.shapes}
            drawable={!training}
            onShapeDraw={handleDrawShape}
            preview
          />
        </div>
        <div className="flex items-center justify-center gap-2 mt-3">
          <NavBtn onClick={() => navigateTo(rootRef.current)} disabled={currentNode === rootRef.current}>⏮</NavBtn>
          <NavBtn onClick={() => currentNode.parent && navigateTo(currentNode.parent)} disabled={!currentNode.parent}>◀</NavBtn>
          {/* Forward navigation hidden in training — it would reveal the solution. */}
          <NavBtn onClick={() => !training && currentNode.children[0] && navigateTo(currentNode.children[0])} disabled={training || !currentNode.children[0]}>▶</NavBtn>
          <NavBtn onClick={() => !training && navigateTo(findDeepestMainLine(rootRef.current))} disabled={training}>⏭</NavBtn>
        </div>
        <div className={`${training ? 'hidden' : 'hidden sm:flex'} items-center justify-center gap-3 mt-2`}>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{t.studyDrawHint}</span>
          {currentNode.shapes?.length ? (
            <button
              type="button"
              onClick={clearShapes}
              className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              🗑 {t.studyClearShapes}
            </button>
          ) : null}
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
          {training ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 py-6 text-center">🙈 {t.studyTrainingHidden}</p>
          ) : (
            <StudyMoveTree root={rootRef.current} currentId={currentNode.id} onSelect={navigateTo} onDelete={canEdit ? handleDeleteBranch : undefined} />
          )}
        </div>
        <NotationButtons
          getZip={getZip}
          getZen={getZen}
          className="flex flex-wrap gap-2"
          buttonClassName="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        />
        {training ? null : canEdit ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
            <div className="flex justify-end mb-1.5">
              <div className="flex text-[11px] font-medium rounded-md overflow-hidden border border-gray-200 dark:border-gray-600">
                <button type="button" onClick={() => setCommentMode('edit')}
                  className={`px-2 py-0.5 ${commentMode === 'edit' ? 'bg-indigo-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  ✎ {t.studyTabEdit}
                </button>
                <button type="button" onClick={() => setCommentMode('read')}
                  className={`px-2 py-0.5 ${commentMode === 'read' ? 'bg-indigo-500 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  👁 {t.studyTabRead}
                </button>
              </div>
            </div>
            {commentMode === 'edit' ? (
              <textarea
                value={currentNode.comment ?? ''}
                onChange={e => updateComment(e.target.value)}
                placeholder={t.studyCommentPlaceholder}
                className="w-full min-h-[90px] text-sm bg-transparent text-gray-800 dark:text-gray-100 resize-y outline-none placeholder:text-gray-400"
              />
            ) : currentNode.comment ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{currentNode.comment}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">{t.studyNoComment}</p>
            )}
          </div>
        ) : currentNode.comment ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{currentNode.comment}</ReactMarkdown>
          </div>
        ) : null}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1">{canEdit ? t.studyEditHint : t.studyExploreHint}</p>
      </div>

      {deleteBranchNode && (
        <ConfirmModal
          message={t.studyDeleteVariantConfirm}
          confirmLabel={t.studyDelete}
          danger
          onClose={() => setDeleteBranchNode(null)}
          onConfirm={confirmDeleteBranch}
        />
      )}
    </div>
  );
}
