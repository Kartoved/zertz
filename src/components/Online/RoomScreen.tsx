import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import HexBoard from '../Board/HexBoard';
import { ChatPanel } from './ChatPanel';
import MarbleSelector from '../UI/MarbleSelector';
import SaveToStudy from '../Studies/SaveToStudy';
import { getValidRemovableRings } from '../../game/Board';
import { getWinType, createInitialState } from '../../game/GameEngine';
import { stateToZip } from '../../game/zip';
import { treeToZen } from '../../game/zen';
import NotationButtons from '../UI/NotationButtons';
import { pickCaptureChain } from '../../store/analysisActions';
import { GameNode } from '../../game/types';
import { nodeDepth, mainLineNodeAtDepth } from '../../utils/gameTreeUtils';
import PlayerProfileModal from '../Auth/PlayerProfileModal';
import RulesContent from '../UI/RulesContent';
import OnlineMoveHistory from '../UI/OnlineMoveHistory';
import OpeningExplorerPanel from './OpeningExplorerPanel';
import { getWinTypeLabel, useI18n } from '../../i18n';

export function RoomScreen() {
  const { t } = useI18n();
  const { toggleDarkMode, isDarkMode } = useUIStore();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const watchOnly = searchParams.get('watch') === '1';
  const [copied, setCopied] = useState(false);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [mobileTab, setMobileTab] = useState<'game' | 'chat' | 'plan'>('game');
  const [rightTab, setRightTab] = useState<'chat' | 'plan'>('chat');
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [winnerModalDismissed, setWinnerModalDismissed] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());
  const [addTimeCooldown, setAddTimeCooldown] = useState(false);

  const navTabs: Array<{ id: string; label: string; authOnly?: boolean }> = [
    { id: 'playLocal', label: t.playLocal },
    { id: 'loadGame', label: t.loadGame },
    { id: 'rules', label: t.rules },
    { id: 'players', label: t.players },
    { id: 'challenges', label: t.challenges, authOnly: true },
  ];
  const topExtraTabs: Array<{ id: 'tasks' | 'community'; label: string }> = [
    { id: 'tasks', label: t.tasks },
    { id: 'community', label: t.community },
  ];

  const {
    state,
    gameTree,
    playerNames,
    myPlayer,
    pendingPlayerChoice,
    user1Id,
    user2Id,
    isLoading,
    error,
    joinRoom,
    claimSeat,
    declineSeat,
    pollRoom,
    pollMessages,
    selectMarbleColor,
    selectedMarbleColor,
    handlePlacement,
    handleRingRemoval,
    handleCapture,
    selectRing,
    selectedRingId,
    highlightedCaptures,
    availableCaptureChains,
    sendMessage,
    currentNode,
    setPlayerName,
    reset,
    rated,
    user1Rating,
    user2Rating,
    ratingDelta,
    winType,
    timeControlBaseMs,
    timeControlIncrementMs,
    clockP1Ms,
    clockP2Ms,
    clockRunningSince,
    surrender,
    addTime,
    cancelGame,
    isAnalyzing,
    analysisState,
    analysisStartNodeId,
    analysisCurrentNode,
    lastLiveMergeAt,
    enterAnalysis,
    exitAnalysis,
    analysisSelectMarbleColor,
    analysisSelectRing,
    analysisHandlePlacement,
    analysisHandleRingRemoval,
    analysisHandleCapture,
    analysisNavigateToNode,
    analysisGameTree,
    deleteAnalysisBranch,
    premoves,
    premoveNotice,
    armAnalysisSubtree,
    clearPremoves,
    pendingMove,
    confirmPendingMove,
    cancelPendingMove,
  } = useRoomStore();
  const { user } = useAuthStore();
  const isAuthed = !!user;

  useEffect(() => {
    if (roomId) {
      joinRoom(roomId, { watchOnly });
    }
    return () => reset();
  }, [roomId, watchOnly]);

  useEffect(() => {
    const interval = setInterval(() => {
      pollRoom();
      pollMessages();
    }, 2000);
    return () => clearInterval(interval);
  }, [pollRoom, pollMessages]);

  useEffect(() => {
    if (!state.winner) {
      setWinnerModalDismissed(false);
    }
  }, [state.winner]);

  // Toast when a live move arrives during analysis. Tracked via a timestamp
  // bumped by pollRoom; we compare against the last-seen value to ignore the
  // initial load and to fire only on actual change.
  const [liveMoveToast, setLiveMoveToast] = useState(false);
  const prevLiveMergeRef = useRef(lastLiveMergeAt);
  useEffect(() => {
    if (lastLiveMergeAt !== prevLiveMergeRef.current && lastLiveMergeAt > 0 && isAnalyzing) {
      setLiveMoveToast(true);
      const timer = setTimeout(() => setLiveMoveToast(false), 3000);
      prevLiveMergeRef.current = lastLiveMergeAt;
      return () => clearTimeout(timer);
    }
    prevLiveMergeRef.current = lastLiveMergeAt;
  }, [lastLiveMergeAt, isAnalyzing]);

  // Toast when the server reports a pre-move event (auto-fired / pruned).
  // Deduped by the notice's `at` timestamp.
  const [premoveToast, setPremoveToast] = useState<string | null>(null);
  // Styled pre-move dialog (replaces window.alert/confirm). When `confirmLabel`
  // is set it's a confirm; otherwise a plain notice.
  const [premoveDialog, setPremoveDialog] = useState<
    { message: string; confirmLabel?: string; onConfirm?: () => void | Promise<void> } | null
  >(null);
  const prevNoticeAtRef = useRef<number>(0);
  useEffect(() => {
    if (!premoveNotice || premoveNotice.at === prevNoticeAtRef.current) return;
    prevNoticeAtRef.current = premoveNotice.at;
    const msg =
      premoveNotice.type === 'fired'
        ? t.premoveFiredToast.replace('{move}', premoveNotice.notation || '')
        : t.premovePrunedToast;
    setPremoveToast(msg);
    const timer = setTimeout(() => setPremoveToast(null), 4000);
    return () => clearTimeout(timer);
  }, [premoveNotice, t]);

  const isTimedGame = timeControlBaseMs != null;

  useEffect(() => {
    if (!isTimedGame || state.winner) return;
    const timer = setInterval(() => setClockNowMs(Date.now()), 250);
    return () => clearInterval(timer);
  }, [isTimedGame, state.winner]);

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getZip = () => stateToZip(state);
  const getZen = () => {
    const start = createInitialState(state.boardSize);
    const result = state.winner === 'player1' ? '1-0' : state.winner === 'player2' ? '0-1' : '*';
    return treeToZen(start, gameTree, {
      Player1: playerNames.player1,
      Player2: playerNames.player2,
      Result: result,
    });
  };

  const canUndoOwnLastMove = () => {
    if (!myPlayer || !currentNode.parent || !!state.winner) return false;
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    return currentNode.player === myPlayerStr;
  };

  const getPhaseText = () => {
    const activeState = isAnalyzing && analysisState ? analysisState : state;
    if (activeState.phase === 'placement') return t.phasePlacement;
    if (activeState.phase === 'ringRemoval') return t.phaseRingRemoval;
    if (activeState.phase === 'capture') return t.phaseCapture;
    return '';
  };

  const isSpectator = !myPlayer;
  const isCancelled = state.winner === 'cancelled';
  const safePlayerNames = playerNames || { player1: 'Player 1', player2: 'Player 2' };
  // Captures reflect whichever state the board is showing: live state normally,
  // analysis state while exploring variants.
  const activeCapturesSrc = isAnalyzing && analysisState ? analysisState.captures : state.captures;
  const safeCaptures = activeCapturesSrc || { player1: { white: 0, gray: 0, black: 0 }, player2: { white: 0, gray: 0, black: 0 } };
  const winnerName = isCancelled ? '' : (state.winner === 'player1' ? safePlayerNames.player1 : safePlayerNames.player2);
  const winnerWinType = state.winner && !isCancelled ? (winType || (state.captures ? getWinType(state, state.winner as import('../../game/types').Player) : null)) : null;
  const canCancel = !isSpectator && !state.winner && (state.moveNumber ?? 0) <= 2;

  const LOW_TIME_THRESHOLD_MS = 20 * 1000;

  const formatClock = (ms: number) => {
    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.floor(safeMs / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // While a correspondence move is awaiting confirmation it hasn't been sent, so
  // for clock purposes it's still the mover's turn — the board `state` has already
  // flipped currentPlayer to the opponent (local preview), so revert that here.
  // This keeps the opponent's clock frozen until the move is actually confirmed.
  const clockTurnPlayer: 'player1' | 'player2' =
    pendingMove && myPlayer != null
      ? (myPlayer === 1 ? 'player1' : 'player2')
      : state.currentPlayer;

  const getDisplayClockMs = (player: 'player1' | 'player2'): number | null => {
    if (!isTimedGame || timeControlBaseMs == null) return null;
    const base = player === 'player1'
      ? (clockP1Ms ?? timeControlBaseMs)
      : (clockP2Ms ?? timeControlBaseMs);

    if (state.winner || !clockRunningSince || clockTurnPlayer !== player) {
      return Math.max(0, base);
    }

    const elapsed = Math.max(0, clockNowMs - clockRunningSince);
    return Math.max(0, base - elapsed);
  };

  const p1ClockMs = getDisplayClockMs('player1');
  const p2ClockMs = getDisplayClockMs('player2');

  // In analysis mode, the board mirrors `analysisState`; otherwise the live state.
  const boardState = isAnalyzing && analysisState ? analysisState : state;
  // Correspondence games are marked with incrementMs === -1 (clock resets each turn).
  // BIGINT columns come back as strings from node-postgres, so coerce.
  const isCorrespondence = timeControlIncrementMs != null && Number(timeControlIncrementMs) === -1;

  // While a move awaits confirmation the turn isn't finished, so the highlight and
  // "whose turn" label stay on the mover (me) even though the board preview has
  // already flipped currentPlayer to the opponent. NOTE: this is display-only — it
  // must NOT feed `isMyTurn`, which gates board interaction (a second move is
  // correctly blocked while pending).
  const displayTurnPlayer: 'player1' | 'player2' =
    pendingMove && myPlayer != null
      ? (myPlayer === 1 ? 'player1' : 'player2')
      : boardState.currentPlayer;
  const turnSubText = pendingMove ? pendingMove.notation : getPhaseText();

  // "Give opponent more time": only in an ongoing timed game, only as a seated
  // player, and only ever applied to the opponent's clock (never your own).
  const canGiveTime = isTimedGame && !state.winner && !isSpectator && myPlayer != null;
  const addTimeLabel = isCorrespondence ? t.addTimeCorr : t.addTimeBlitz;
  const handleAddTime = async () => {
    if (addTimeCooldown) return;
    setAddTimeCooldown(true);
    try {
      await addTime();
    } finally {
      setTimeout(() => setAddTimeCooldown(false), 3000);
    }
  };

  const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';

  // The plan is rooted at the LIVE position (the analysis node at the live
  // game's depth), so moves already played in the game drop out of the plan
  // instead of lingering. Variations under it render as a navigable tree.
  const analysisAnchor = isAnalyzing && analysisGameTree
    ? mainLineNodeAtDepth(analysisGameTree, nodeDepth(currentNode))
    : null;
  const analysisPlanNodes = analysisAnchor ? analysisAnchor.children.filter(c => c.move) : [];

  // Snapshot every variation built in the analysis board into the pre-move tree
  // (the "build on the board, then arm" flow). Replaces whatever was armed.
  // When my own move leads the plan, confirm and play it live before arming.
  const handleArmSubtree = async () => {
    const res = await armAnalysisSubtree(false);
    if (res.ok) {
      if (res.droppedMyAlternatives) setPremoveDialog({ message: t.armDroppedAlternatives });
      return;
    }
    if (res.reason === 'ownMoveFirst') {
      setPremoveDialog({
        message: t.confirmPlayOwnMove.replace('{move}', res.firstMoveNotation || ''),
        confirmLabel: t.playAndArm,
        onConfirm: async () => {
          const r2 = await armAnalysisSubtree(true);
          if (r2.ok && r2.droppedMyAlternatives) setPremoveDialog({ message: t.armDroppedAlternatives });
          else if (!r2.ok && r2.reason === 'incompleteMove') setPremoveDialog({ message: t.armIncompleteMove });
        },
      });
      return;
    }
    if (res.reason === 'incompleteMove') {
      setPremoveDialog({ message: t.armIncompleteMove });
      return;
    }
    setPremoveDialog({ message: t.armNothingToArm });
  };
  const effectiveSelectRing = isAnalyzing ? analysisSelectRing : selectRing;
  const effectiveHandlePlacement = isAnalyzing ? analysisHandlePlacement : handlePlacement;
  const effectiveHandleRingRemoval = isAnalyzing ? analysisHandleRingRemoval : handleRingRemoval;
  const effectiveHandleCapture = isAnalyzing ? analysisHandleCapture : handleCapture;

  // Plan tab — pre-moves panel — only available to correspondence participants in analysis.
  const planTabAvailable = isCorrespondence && !isSpectator && isAnalyzing;
  useEffect(() => {
    if (planTabAvailable) {
      setRightTab('plan');
    } else {
      setRightTab('chat');
      setMobileTab(prev => (prev === 'plan' ? 'game' : prev));
    }
  }, [planTabAvailable]);

  // Recursively renders the analysis variation tree: navigable (click = jump to
  // that position), current node highlighted, each branch removable. This is the
  // single place branches live — the top strip stays a clean linear line.
  const renderAnalysisNodes = (nodes: GameNode[], depth: number): JSX.Element[] =>
    nodes
      .filter(n => n.move)
      .map(n => {
        const isOpponent = n.player !== myPlayerStr;
        const isCurrent = n.id === analysisCurrentNode?.id;
        return (
          <div key={n.id}>
            <div className="flex items-center gap-1" style={{ paddingLeft: depth * 12 }}>
              <span
                onClick={() => analysisNavigateToNode(n)}
                className={`flex-1 min-w-0 font-mono text-[11px] leading-snug cursor-pointer rounded px-1 ${
                  isCurrent
                    ? 'bg-blue-500 text-white'
                    : isOpponent
                    ? 'text-gray-500 dark:text-gray-400 italic hover:bg-gray-200 dark:hover:bg-gray-700'
                    : 'text-blue-700 dark:text-blue-300 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {isOpponent ? '⟵ ' : '⟶ '}{n.notation}
              </span>
              <button
                type="button"
                onClick={() => deleteAnalysisBranch(n.id)}
                title={t.deleteVariant}
                className="flex-shrink-0 text-red-500 hover:text-red-600 px-1"
              >
                ✕
              </button>
            </div>
            {n.children.length > 0 && renderAnalysisNodes(n.children, depth + 1)}
          </div>
        );
      });

  const preMovesPanelContent = (
    <div className="h-full overflow-y-auto p-3">
      <button
        type="button"
        onClick={handleArmSubtree}
        className="w-full px-3 py-2 rounded bg-green-500 hover:bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-1.5"
      >
        ⚡ {t.armFromAnalysis}
      </button>
      <div className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
        {t.armFromAnalysisHint}
      </div>

      <div className="mt-3">
        {analysisPlanNodes.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">{t.planBuildHint}</div>
        ) : (
          <div className="space-y-0.5">{renderAnalysisNodes(analysisPlanNodes, 0)}</div>
        )}
      </div>

      {premoves && premoves.children.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
          <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">
            ⚡ {t.premoveArmedCount.replace('{n}', String(premoves.children.length))}
          </span>
          <button
            type="button"
            onClick={() => clearPremoves()}
            className="text-[10px] text-red-500 hover:text-red-600"
          >
            {t.clearAllVariants}
          </button>
        </div>
      )}

      <div className="mt-3 text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
        <div>⟵ — {t.opponentTurn.toLowerCase()}</div>
        <div>⟶ — {t.yourTurn.toLowerCase()}</div>
        <div className="mt-1">{t.premovesHint}</div>
      </div>
    </div>
  );

  const validRemovableRings = boardState.phase === 'ringRemoval'
    ? getValidRemovableRings(boardState.rings)
    : [];

  // ---- Mobile compact strips ----
  // Determine which slot is "top" (opponent's view) and which is "bottom" (your view).
  // Spectators default to player1 top / player2 bottom (chess-board convention).
  const topSlot: 'player1' | 'player2' = myPlayer === 1 ? 'player2' : 'player1';
  const bottomSlot: 'player1' | 'player2' = topSlot === 'player1' ? 'player2' : 'player1';
  const topClockMs = topSlot === 'player1' ? p1ClockMs : p2ClockMs;
  const bottomClockMs = bottomSlot === 'player1' ? p1ClockMs : p2ClockMs;
  const topRating = topSlot === 'player1' ? user1Rating : user2Rating;
  const bottomRating = bottomSlot === 'player1' ? user1Rating : user2Rating;
  const topUserId = topSlot === 'player1' ? user1Id : user2Id;
  const bottomUserId = bottomSlot === 'player1' ? user1Id : user2Id;
  const isMyTurn = !state.winner && !isSpectator && state.currentPlayer === bottomSlot;

  const renderMobilePlayerStrip = (
    slot: 'player1' | 'player2',
    clockMs: number | null,
    rating: number | null | undefined,
    userId: number | null | undefined,
    isBottom: boolean
  ) => {
    const isActive = !boardState.winner && displayTurnPlayer === slot;
    const caps = safeCaptures[slot];
    const name = safePlayerNames[slot];
    const isMine = !isSpectator && myPlayer != null && ((myPlayer === 1 ? 'player1' : 'player2') === slot);
    return (
      <div className={`lg:hidden flex items-center gap-2 px-3 py-1.5 ${
        isActive ? 'bg-blue-100 dark:bg-blue-900 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-800'
      }`}>
        {/* Captures */}
        <div className="flex gap-1 text-xs font-medium text-gray-800 dark:text-gray-200 flex-shrink-0">
          <span>⚪{caps.white}</span>
          <span>🔘{caps.gray}</span>
          <span>⚫{caps.black}</span>
        </div>
        {/* Name + sub-line (rating / phase) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isMine && <span className="text-[10px] bg-green-500 text-white px-1 py-0.5 rounded leading-none">{t.you}</span>}
            {isAuthed && userId ? (
              <button
                type="button"
                onClick={() => setSelectedPlayerId(userId)}
                className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate hover:underline"
              >
                {name}
              </button>
            ) : (
              <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{name}</span>
            )}
            {rating != null && (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">{rating}</span>
            )}
          </div>
          {isActive && (
            <div className="text-[10px] text-blue-700 dark:text-blue-200 truncate">
              {isMine ? t.yourTurn : t.opponentTurn} · {turnSubText}
            </div>
          )}
        </div>
        {/* Clock */}
        {clockMs != null && (
          <div className={`text-sm font-mono font-bold flex-shrink-0 ${
            clockMs <= LOW_TIME_THRESHOLD_MS ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
          }`}>
            {formatClock(clockMs)}
          </div>
        )}
        {/* Give opponent more time — only on the opponent's strip */}
        {!isMine && canGiveTime && (
          <button
            type="button"
            onClick={handleAddTime}
            disabled={addTimeCooldown}
            title={t.addTime}
            className="flex-shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-40 disabled:cursor-default"
          >
            ⏱ {addTimeLabel}
          </button>
        )}
        {/* Action menu — only on bottom strip */}
        {isBottom && isAuthed && (
          <button
            type="button"
            onClick={() => setShowMobileActions(true)}
            className="flex-shrink-0 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Actions"
          >
            ⋯
          </button>
        )}
      </div>
    );
  };

  const mobileOpponentStrip = renderMobilePlayerStrip(topSlot, topClockMs, topRating, topUserId, false);
  const mobileYouStrip = renderMobilePlayerStrip(bottomSlot, bottomClockMs, bottomRating, bottomUserId, true);

  // Marble picker (mobile): visible when in placement phase and acting player has agency.
  const shouldShowMobileMarblePicker = boardState.phase === 'placement' && !boardState.winner &&
    (isAnalyzing || isMyTurn);
  const mobileMarblePicker = shouldShowMobileMarblePicker ? (
    <div className="lg:hidden p-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <MarbleSelector
        reserve={boardState.reserve}
        selectedColor={selectedMarbleColor}
        onSelect={isAnalyzing ? analysisSelectMarbleColor : selectMarbleColor}
        captures={boardState.captures[boardState.currentPlayer]}
        phase={boardState.phase}
        currentPlayer={boardState.currentPlayer}
        stateForCaptures={boardState}
      />
    </div>
  ) : null;

  const handleRingClick = (ringId: string) => {
    if (boardState.winner) return;

    const ring = boardState.rings.get(ringId);
    if (!ring || ring.isRemoved) return;

    if (boardState.phase === 'ringRemoval') {
      if (validRemovableRings.includes(ringId)) {
        effectiveHandleRingRemoval(ringId);
      }
    } else if (boardState.phase === 'capture') {
      // Match the chain whose *terminal* landing equals the clicked ring.
      // Chains share an intermediate `to` when they branch — only the terminal
      // is unique per chain, so matching there disambiguates the user's intent.
      if (selectedRingId) {
        // In analysis, disambiguate same-terminal chains so a second capture
        // branch can be built (see pickCaptureChain).
        const chain = pickCaptureChain(availableCaptureChains, ringId, isAnalyzing ? analysisCurrentNode : null);
        if (chain) {
          effectiveHandleCapture(chain);
          return;
        }
      }
      if (ring.marble) {
        effectiveSelectRing(ringId);
      }
    } else if (boardState.phase === 'placement') {
      if (!ring.marble && selectedMarbleColor) {
        effectiveHandlePlacement(ringId);
      } else if (!ring.marble) {
        effectiveSelectRing(ringId);
      }
    }
  };

  const handleNameEdit = (player: 1 | 2, name: string) => {
    if (name.trim()) {
      setPlayerName(player, name.trim());
    }
  };

  const handleMobileMenuAction = (tabId: string) => {
    setShowMobileHeaderMenu(false);
    if (tabId === 'rules') {
      setShowRulesModal(true);
      return;
    }
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-xl text-gray-600 dark:text-gray-400">{t.loading}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 gap-4">
        <div className="text-xl text-red-500">{error}</div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {t.backToMenu}
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen h-[100dvh] overflow-hidden bg-gray-100 dark:bg-gray-900 flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm p-3 md:p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={() => setShowMobileHeaderMenu((prev) => !prev)}
              className="md:hidden px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg"
              title={showMobileHeaderMenu ? t.closeMenu : t.openMenu}
            >
              {showMobileHeaderMenu ? '✕' : '☰'}
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← {t.roomMenu}
            </button>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-200">
              ZÈRTZ Online
            </h1>
          </div>

          <div className="hidden md:block flex-1 min-w-[220px] md:mx-3">
            <OnlineMoveHistory />
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setShowRulesModal(true)}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              📘 {t.roomRules}
            </button>
            <button
              onClick={copyLink}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              {copied ? t.copied : `🔗 ${t.copyRoomLink}`}
            </button>
            <NotationButtons
              getZip={getZip}
              getZen={getZen}
              className="contents"
              buttonClassName="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            />
            <button
              onClick={toggleDarkMode}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title={isDarkMode ? t.lightMode : t.darkMode}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile move history strip — mirrors the desktop header version, sits just under the header. */}
      <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 py-1 overflow-x-auto">
        <OnlineMoveHistory />
      </div>

      {showMobileHeaderMenu && (
        <div className="md:hidden px-3 pb-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            {navTabs
              .filter((tab) => !tab.authOnly || user)
              .map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleMobileMenuAction(tab.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700"
                >
                  {tab.label}
                </button>
              ))}
            {topExtraTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600"
              >
                {tab.label}
              </button>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setShowMobileHeaderMenu(false);
                  setShowRulesModal(true);
                }}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg"
              >
                📘 {t.roomRules}
              </button>
              <button
                onClick={copyLink}
                className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg"
              >
                {copied ? t.copied : `🔗 ${t.copyRoomLink}`}
              </button>
              <button
                onClick={() => {
                  setShowMobileHeaderMenu(false);
                  setMobileTab('chat');
                }}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg"
              >
                💬 {t.chat}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 md:gap-4 p-2 md:p-4 max-w-7xl mx-auto w-full pb-28 sm:pb-24 lg:pb-4 overflow-y-auto lg:overflow-hidden">
        {/* Left panel - Players (desktop only — mobile uses compact strips around the board) */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col gap-2 lg:gap-4 min-w-0">
          {/* Player 1 */}
          <div className={`p-2 lg:p-3 rounded-lg ${
            displayTurnPlayer === 'player1' && !boardState.winner
              ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500'
              : 'bg-white dark:bg-gray-800'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {myPlayer === 1 && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">{t.you}</span>}
              {isAuthed ? (
                <button
                  type="button"
                  disabled={!user1Id}
                  onClick={() => user1Id && setSelectedPlayerId(user1Id)}
                  className="font-semibold text-gray-800 dark:text-gray-200 text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline disabled:no-underline disabled:cursor-default disabled:hover:text-gray-800 dark:disabled:hover:text-gray-200"
                >
                  {safePlayerNames.player1}
                </button>
              ) : (
                <input
                  type="text"
                  defaultValue={playerNames.player1}
                  onBlur={(e) => handleNameEdit(1, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-b border-transparent 
                             hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full"
                />
              )}
              {user1Rating != null && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{user1Rating}</span>
              )}
            </div>
            {p1ClockMs != null && (
              <div className="mb-1 flex items-center gap-2">
                <span className={`text-lg font-mono font-bold ${
                  p1ClockMs <= LOW_TIME_THRESHOLD_MS
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {formatClock(p1ClockMs)}
                </span>
                {myPlayer !== 1 && canGiveTime && (
                  <button
                    type="button"
                    onClick={handleAddTime}
                    disabled={addTimeCooldown}
                    title={t.addTime}
                    className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-40 disabled:cursor-default"
                  >
                    ⏱ {addTimeLabel}
                  </button>
                )}
              </div>
            )}
            {ratingDelta && state.winner && rated && (
              <div className="text-xs mb-1">
                <span className="text-gray-500 dark:text-gray-400">{ratingDelta?.player1?.before} → {ratingDelta?.player1?.after}</span>
                <span className={`ml-1 font-bold ${(ratingDelta?.player1?.delta ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(ratingDelta?.player1?.delta ?? 0) >= 0 ? '+' : ''}{ratingDelta?.player1?.delta}
                </span>
              </div>
            )}
            <div className="flex gap-2 text-xs lg:text-sm text-gray-800 dark:text-gray-200">
              <span>⚪ {safeCaptures.player1.white}</span>
              <span>🔘 {safeCaptures.player1.gray}</span>
              <span>⚫ {safeCaptures.player1.black}</span>
            </div>
            {displayTurnPlayer === 'player1' && !boardState.winner && (
              <div className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-200">
                <div>{myPlayer === 1 ? t.yourTurn : t.opponentTurn}</div>
                <div className="text-xs text-blue-600/90 dark:text-blue-300/90">{turnSubText}</div>
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div className={`p-2 lg:p-3 rounded-lg ${
            displayTurnPlayer === 'player2' && !boardState.winner
              ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500'
              : 'bg-white dark:bg-gray-800'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {myPlayer === 2 && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">{t.you}</span>}
              {isAuthed ? (
                <button
                  type="button"
                  disabled={!user2Id}
                  onClick={() => user2Id && setSelectedPlayerId(user2Id)}
                  className="font-semibold text-gray-800 dark:text-gray-200 text-left hover:text-blue-600 dark:hover:text-blue-400 hover:underline disabled:no-underline disabled:cursor-default disabled:hover:text-gray-800 dark:disabled:hover:text-gray-200"
                >
                  {safePlayerNames.player2}
                </button>
              ) : (
                <input
                  type="text"
                  defaultValue={playerNames.player2}
                  onBlur={(e) => handleNameEdit(2, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-b border-transparent 
                             hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full"
                />
              )}
              {user2Rating != null && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{user2Rating}</span>
              )}
            </div>
            {p2ClockMs != null && (
              <div className="mb-1 flex items-center gap-2">
                <span className={`text-lg font-mono font-bold ${
                  p2ClockMs <= LOW_TIME_THRESHOLD_MS
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {formatClock(p2ClockMs)}
                </span>
                {myPlayer !== 2 && canGiveTime && (
                  <button
                    type="button"
                    onClick={handleAddTime}
                    disabled={addTimeCooldown}
                    title={t.addTime}
                    className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-40 disabled:cursor-default"
                  >
                    ⏱ {addTimeLabel}
                  </button>
                )}
              </div>
            )}
            {ratingDelta && state.winner && rated && (
              <div className="text-xs mb-1">
                <span className="text-gray-500 dark:text-gray-400">{ratingDelta?.player2?.before} → {ratingDelta?.player2?.after}</span>
                <span className={`ml-1 font-bold ${(ratingDelta?.player2?.delta ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(ratingDelta?.player2?.delta ?? 0) >= 0 ? '+' : ''}{ratingDelta?.player2?.delta}
                </span>
              </div>
            )}
            <div className="flex gap-2 text-xs lg:text-sm text-gray-800 dark:text-gray-200">
              <span>⚪ {safeCaptures.player2.white}</span>
              <span>🔘 {safeCaptures.player2.gray}</span>
              <span>⚫ {safeCaptures.player2.black}</span>
            </div>
            {displayTurnPlayer === 'player2' && !boardState.winner && (
              <div className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-200">
                <div>{myPlayer === 2 ? t.yourTurn : t.opponentTurn}</div>
                <div className="text-xs text-blue-600/90 dark:text-blue-300/90">{turnSubText}</div>
              </div>
            )}
          </div>

          {/* Spectator badge — visible to anyone watching, even anonymous */}
          {isSpectator && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-1 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg text-center text-sm text-yellow-700 dark:text-yellow-300 font-medium">
              👁 {t.youAreSpectator}
            </div>
          )}

          {/* Standalone analysis card — shown only when there's no live action panel
              to host the Analyze button (spectators, finished games, or when in
              analysis mode itself which renders the full panel here). */}
          {isAuthed && (isAnalyzing || state.winner || isSpectator) && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-1 p-3 bg-white dark:bg-gray-800 rounded-lg space-y-2">
              {isAnalyzing && (
                <div className="px-2 py-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold text-center">
                  <div>🔬 {t.analysisMode}</div>
                  {boardState.winner && boardState.winner !== 'cancelled' ? (
                    <div className="mt-1 text-[11px] font-normal text-amber-700 dark:text-amber-300">
                      🏆 {boardState.winner === 'player1' ? safePlayerNames.player1 : safePlayerNames.player2}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] font-normal text-amber-700 dark:text-amber-300">
                      {boardState.currentPlayer === 'player1' ? safePlayerNames.player1 : safePlayerNames.player2}
                      {' · '}
                      {boardState.phase === 'placement' && t.phasePlacement}
                      {boardState.phase === 'ringRemoval' && t.phaseRingRemoval}
                      {boardState.phase === 'capture' && t.phaseCapture}
                    </div>
                  )}
                </div>
              )}
              {isAnalyzing && boardState.phase === 'placement' && !boardState.winner && (
                <MarbleSelector
                  reserve={boardState.reserve}
                  selectedColor={selectedMarbleColor}
                  onSelect={analysisSelectMarbleColor}
                  captures={boardState.captures[boardState.currentPlayer]}
                  phase={boardState.phase}
                  currentPlayer={boardState.currentPlayer}
                  stateForCaptures={boardState}
                />
              )}
              {isAnalyzing && analysisCurrentNode && analysisCurrentNode.id !== analysisStartNodeId && (
                <button
                  type="button"
                  onClick={() => analysisCurrentNode.parent && analysisNavigateToNode(analysisCurrentNode.parent)}
                  className="w-full px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  ↶ {t.undoMove}
                </button>
              )}
              {isAnalyzing ? (
                <button
                  type="button"
                  onClick={exitAnalysis}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                >
                  ← {t.exitAnalysis}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={enterAnalysis}
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70 transition-colors"
                >
                  🔬 {t.analysis}
                </button>
              )}
              <SaveToStudy state={boardState} />
            </div>
          )}

          {/* Opening explorer — only visible while analyzing */}
          {isAnalyzing && <OpeningExplorerPanel />}

          {/* Live participant action panel — active participant, not in analysis */}
          {!state.winner && !isSpectator && !isAnalyzing && (
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg col-span-1 sm:col-span-2 lg:col-span-1">
              {state.phase === 'placement' && (
                <MarbleSelector
                  reserve={state.reserve}
                  selectedColor={selectedMarbleColor}
                  onSelect={selectMarbleColor}
                  captures={state.captures[state.currentPlayer]}
                  phase={state.phase}
                  currentPlayer={state.currentPlayer}
                  stateForCaptures={state}
                />
              )}
              <div className={state.phase === 'placement' ? 'mt-3' : ''}>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => sendMessage('[UNDO_REQUEST]')}
                    disabled={!canUndoOwnLastMove()}
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ↶ {t.undoMove}
                  </button>
                  {canCancel ? (
                    <button
                      type="button"
                      onClick={() => cancelGame()}
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70 transition-colors"
                    >
                      ✕ {t.cancelGame}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSurrenderConfirm(true)}
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-black hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      🏳️ {t.surrender}
                    </button>
                  )}
                </div>
                {isAuthed && (
                  <button
                    type="button"
                    onClick={enterAnalysis}
                    className="mt-2 w-full px-3 py-1.5 text-sm rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70 transition-colors"
                  >
                    🔬 {t.analysis}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Center - Board (mobile: framed by compact strips; desktop: just the board) */}
        <div className={`flex-1 min-h-0 min-h-[240px] sm:min-h-[320px] md:min-h-[400px] ${mobileTab === 'chat' ? 'hidden lg:flex' : 'flex flex-col'}`}>
          {/* Spectator badge (mobile) */}
          {isSpectator && (
            <div className="lg:hidden mx-3 mt-1 px-2 py-1 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded text-center text-xs text-yellow-700 dark:text-yellow-300 font-medium">
              👁 {t.youAreSpectator}
            </div>
          )}
          {/* Analysis badge (mobile) */}
          {isAnalyzing && (
            <div className="lg:hidden mx-3 mt-1 px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold text-center">
              🔬 {t.analysisMode}
            </div>
          )}
          {/* Opponent strip (mobile only) */}
          {mobileOpponentStrip}
          {/* Board */}
          <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
            <HexBoard
              state={boardState}
              onRingClick={handleRingClick}
              selectedRingId={selectedRingId}
              highlightedCaptures={highlightedCaptures}
              validRemovableRings={validRemovableRings}
            />
          </div>
          {/* You strip (mobile only) */}
          {mobileYouStrip}
          {/* Marble picker (mobile only, conditional) */}
          {mobileMarblePicker}
        </div>

        {mobileTab === 'chat' && (
          <div className="lg:hidden fixed inset-x-0 z-10 flex flex-col p-2" style={{ top: '56px', bottom: '60px' }}>
            <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <ChatPanel />
            </div>
          </div>
        )}

        {mobileTab === 'plan' && planTabAvailable && (
          <div className="lg:hidden fixed inset-x-0 z-10 flex flex-col p-2" style={{ top: '56px', bottom: '60px' }}>
            <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200">
                {t.conditionalPremoves}
              </div>
              <div className="flex-1 min-h-0">{preMovesPanelContent}</div>
            </div>
          </div>
        )}

        {/* Right panel - Chat / Plan tabs (desktop, collapsible) */}
        <div className={`hidden lg:flex min-h-0 flex-col transition-all duration-300 ${
          chatCollapsed ? 'lg:w-12' : 'lg:w-80'
        }`}>
          <button
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className="mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700
                       flex items-center justify-center transition-colors"
            title={chatCollapsed ? t.expandChat : t.collapseChat}
          >
            {chatCollapsed ? '💬' : '→'}
          </button>
          {!chatCollapsed && (
            <>
              {planTabAvailable && (
                <div className="mb-2 grid grid-cols-2 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setRightTab('chat')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      rightTab === 'chat'
                        ? 'bg-indigo-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t.chat}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightTab('plan')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      rightTab === 'plan'
                        ? 'bg-indigo-500 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t.tabPlan}
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-hidden">
                {planTabAvailable && rightTab === 'plan' ? (
                  <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    {preMovesPanelContent}
                  </div>
                ) : (
                  <ChatPanel />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className={`grid ${planTabAvailable ? 'grid-cols-3' : 'grid-cols-2'} bg-white dark:bg-gray-800 rounded-xl p-1 shadow-lg border border-gray-200 dark:border-gray-700`}>
          <button
            type="button"
            onClick={() => setMobileTab('game')}
            className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
              mobileTab === 'game'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t.tabPlay}
          </button>
          {planTabAvailable && (
            <button
              type="button"
              onClick={() => setMobileTab('plan')}
              className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
                mobileTab === 'plan'
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t.tabPlan}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileTab('chat')}
            className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
              mobileTab === 'chat'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t.chat}
          </button>
        </div>
      </div>

      {/* Mobile actions sheet — Undo / Analysis / Cancel / Resign */}
      {showMobileActions && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowMobileActions(false)}>
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-2xl shadow-2xl p-3 space-y-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            {isAnalyzing ? (
              <>
                {analysisCurrentNode && analysisStartNodeId && analysisCurrentNode.id !== analysisStartNodeId && (
                  <button
                    type="button"
                    onClick={() => { analysisCurrentNode.parent && analysisNavigateToNode(analysisCurrentNode.parent); setShowMobileActions(false); }}
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    ↶ {t.undoMove}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { exitAnalysis(); setShowMobileActions(false); }}
                  className="w-full px-3 py-2.5 text-sm font-semibold rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
                >
                  ← {t.exitAnalysis}
                </button>
              </>
            ) : (
              <>
                {!isSpectator && !state.winner && (
                  <button
                    type="button"
                    onClick={() => { sendMessage('[UNDO_REQUEST]'); setShowMobileActions(false); }}
                    disabled={!canUndoOwnLastMove()}
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ↶ {t.undoMove}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { enterAnalysis(); setShowMobileActions(false); }}
                  className="w-full px-3 py-2.5 text-sm rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/70"
                >
                  🔬 {t.analysis}
                </button>
                <SaveToStudy state={boardState} className="w-full px-3 py-2.5 text-sm rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/70" />
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => { cancelGame(); setShowMobileActions(false); }}
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70"
                  >
                    ✕ {t.cancelGame}
                  </button>
                )}
                {!isSpectator && !state.winner && !canCancel && (
                  <button
                    type="button"
                    onClick={() => { setShowMobileActions(false); setShowSurrenderConfirm(true); }}
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-black hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    🏳️ {t.surrender}
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setShowMobileActions(false)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400"
            >
              {t.cancel || 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {showSurrenderConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.confirmSurrenderTitle}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t.confirmSurrenderText}</p>
            </div>
            <div className="p-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowSurrenderConfirm(false)}
                className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t.cancelAction}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowSurrenderConfirm(false);
                  await surrender();
                }}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
              >
                {t.confirmAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPlayerId && (
        <PlayerProfileModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {state.winner && !winnerModalDismissed && !isAnalyzing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
            {isCancelled ? (
              <>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-2">
                  ✕ {t.gameCancelled}
                </div>
                <div className="text-gray-500 dark:text-gray-400 mb-6">{t.cancelledStatus}</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
                  🏆 {winnerName}
                </div>
                <div className="text-gray-600 dark:text-gray-300 mb-1">{t.gameOver}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {getWinTypeLabel(t, winnerWinType)}
                </div>
              </>
            )}
            <button
              onClick={() => setWinnerModalDismissed(true)}
              className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {pendingPlayerChoice && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-5 text-center">
              <div className="text-2xl mb-2">♟</div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t.joinSeatTitle}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">{t.joinSeatPrompt}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={declineSeat}
                  className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  👁 {t.watchGame}
                </button>
                <button
                  type="button"
                  onClick={claimSeat}
                  className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                >
                  ▶ {t.joinAsPlayer}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {liveMoveToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 bg-amber-500 text-white rounded-lg shadow-lg text-sm font-medium animate-pulse pointer-events-none">
          ⚡ {t.liveMoveDuringAnalysis}
        </div>
      )}

      {premoveToast && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-lg text-sm font-medium pointer-events-none">
          {premoveToast}
        </div>
      )}

      {premoveDialog && (
        <div
          className="fixed inset-0 bg-black/50 z-[95] flex items-center justify-center p-4"
          onClick={() => setPremoveDialog(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl flex-shrink-0">⚡</span>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{premoveDialog.message}</p>
            </div>
            <div className="flex justify-end gap-2">
              {premoveDialog.confirmLabel ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPremoveDialog(null)}
                    className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fn = premoveDialog.onConfirm;
                      setPremoveDialog(null);
                      fn?.();
                    }}
                    className="px-4 py-1.5 rounded text-sm font-bold text-white bg-green-500 hover:bg-green-600"
                  >
                    {premoveDialog.confirmLabel}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setPremoveDialog(null)}
                  className="px-4 py-1.5 rounded text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Correspondence-only "Send move?" confirmation — the move is shown on the
          board as a preview and only sent once confirmed, so accidental taps in
          async games don't fire a real move. */}
      {pendingMove && !isAnalyzing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-2 border-green-500 rounded-2xl shadow-2xl px-6 py-5 animate-[fadeInScale_150ms_ease-out]">
            <span className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-50 text-center">
              {t.confirmSendMove.replace('{move}', pendingMove.notation)}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => cancelPendingMove()}
                className="px-5 py-2 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => confirmPendingMove()}
                className="px-6 py-2 rounded-full text-sm font-bold text-white bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/30"
              >
                {t.sendMove}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Pre-move armed" indicator — shown while waiting on the opponent. */}
      {!isAnalyzing && !state.winner && !isSpectator && premoves && premoves.children.length > 0 &&
        state.currentPlayer !== myPlayerStr && (
        <div className="fixed bottom-24 lg:bottom-6 right-4 z-[80] px-3 py-1.5 bg-indigo-600/90 text-white rounded-full shadow-lg text-xs font-medium flex items-center gap-1 pointer-events-none">
          ⚡ {t.premoveArmed}
        </div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRulesModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.gameRulesTitle}</h2>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <RulesContent />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
