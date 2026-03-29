import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import HexBoard from '../Board/HexBoard';
import { ChatPanel } from './ChatPanel';
import MarbleSelector from '../UI/MarbleSelector';
import { getValidRemovableRings } from '../../game/Board';
import { getWinType } from '../../game/GameEngine';
import PlayerProfileModal from '../Auth/PlayerProfileModal';
import RulesContent from '../UI/RulesContent';
import OnlineMoveHistory from '../UI/OnlineMoveHistory';
import { getWinTypeLabel, useI18n } from '../../i18n';

export function RoomScreen() {
  const { t } = useI18n();
  const { toggleDarkMode, isDarkMode } = useUIStore();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [mobileTab, setMobileTab] = useState<'game' | 'chat'>('game');
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [winnerModalDismissed, setWinnerModalDismissed] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());

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
    clockP1Ms,
    clockP2Ms,
    clockRunningSince,
    surrender,
    cancelGame,
  } = useRoomStore();
  const { user } = useAuthStore();
  const isAuthed = !!user;

  useEffect(() => {
    if (roomId) {
      joinRoom(roomId);
    }
    return () => reset();
  }, [roomId]);

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

  const canUndoOwnLastMove = () => {
    if (!myPlayer || !currentNode.parent || !!state.winner) return false;
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    return currentNode.player === myPlayerStr;
  };

  const getPhaseText = () => {
    if (state.phase === 'placement') return t.phasePlacement;
    if (state.phase === 'ringRemoval') return t.phaseRingRemoval;
    if (state.phase === 'capture') return t.phaseCapture;
    return '';
  };

  const isSpectator = !myPlayer;
  const isCancelled = state.winner === 'cancelled';
  const safePlayerNames = playerNames || { player1: 'Player 1', player2: 'Player 2' };
  const safeCaptures = state.captures || { player1: { white: 0, gray: 0, black: 0 }, player2: { white: 0, gray: 0, black: 0 } };
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

  const getDisplayClockMs = (player: 'player1' | 'player2'): number | null => {
    if (!isTimedGame || timeControlBaseMs == null) return null;
    const base = player === 'player1'
      ? (clockP1Ms ?? timeControlBaseMs)
      : (clockP2Ms ?? timeControlBaseMs);

    if (state.winner || !clockRunningSince || state.currentPlayer !== player) {
      return Math.max(0, base);
    }

    const elapsed = Math.max(0, clockNowMs - clockRunningSince);
    return Math.max(0, base - elapsed);
  };

  const p1ClockMs = getDisplayClockMs('player1');
  const p2ClockMs = getDisplayClockMs('player2');

  const validRemovableRings = state.phase === 'ringRemoval' 
    ? getValidRemovableRings(state.rings) 
    : [];

  const handleRingClick = (ringId: string) => {
    console.log('[RoomScreen.handleRingClick]', { ringId, phase: state.phase, selectedMarbleColor, winner: state.winner });
    if (state.winner) return;

    const ring = state.rings.get(ringId);
    if (!ring || ring.isRemoved) return;

    if (state.phase === 'ringRemoval') {
      if (validRemovableRings.includes(ringId)) {
        handleRingRemoval(ringId);
      }
    } else if (state.phase === 'capture') {
      if (selectedRingId && highlightedCaptures.some(c => c.to === ringId)) {
        const chain = availableCaptureChains.find(chain =>
          chain.some(c => c.to === ringId)
        );
        if (chain) {
          handleCapture(chain);
        }
      } else if (ring.marble) {
        selectRing(ringId);
      }
    } else if (state.phase === 'placement') {
      if (!ring.marble && selectedMarbleColor) {
        console.log('[RoomScreen] calling handlePlacement', ringId);
        handlePlacement(ringId);
      } else if (!ring.marble) {
        selectRing(ringId);
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-gray-100 dark:bg-gray-900 flex flex-col overflow-x-hidden">
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
        {/* Left panel - Players */}
        <div className={`lg:w-64 lg:flex lg:flex-col gap-2 lg:gap-4 ${mobileTab === 'chat' ? 'hidden lg:flex' : 'grid grid-cols-2 lg:grid-cols-1'} min-w-0`}>
          {/* Player 1 */}
          <div className={`p-2 lg:p-3 rounded-lg ${
            state.currentPlayer === 'player1' && !state.winner
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
              <div className={`mb-1 text-lg font-mono font-bold ${
                p1ClockMs <= LOW_TIME_THRESHOLD_MS
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {formatClock(p1ClockMs)}
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
            {state.currentPlayer === 'player1' && !state.winner && (
              <div className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-200">
                <div>{myPlayer === 1 ? t.yourTurn : t.opponentTurn}</div>
                <div className="text-xs text-blue-600/90 dark:text-blue-300/90">{getPhaseText()}</div>
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div className={`p-2 lg:p-3 rounded-lg ${
            state.currentPlayer === 'player2' && !state.winner
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
              <div className={`mb-1 text-lg font-mono font-bold ${
                p2ClockMs <= LOW_TIME_THRESHOLD_MS
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {formatClock(p2ClockMs)}
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
            {state.currentPlayer === 'player2' && !state.winner && (
              <div className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-200">
                <div>{myPlayer === 2 ? t.yourTurn : t.opponentTurn}</div>
                <div className="text-xs text-blue-600/90 dark:text-blue-300/90">{getPhaseText()}</div>
              </div>
            )}
          </div>

          {/* Spectator badge */}
          {isSpectator && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-1 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg text-center text-sm text-yellow-700 dark:text-yellow-300 font-medium">
              👁 {t.youAreSpectator}
            </div>
          )}

          {/* Marble selector + action buttons (players only) */}
          {!state.winner && !isSpectator && (
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg col-span-1 sm:col-span-2 lg:col-span-1">
              {state.phase === 'placement' && (
                <>
                  <MarbleSelector
                    reserve={state.reserve}
                    selectedColor={selectedMarbleColor}
                    onSelect={selectMarbleColor}
                    captures={state.captures[state.currentPlayer]}
                    phase={state.phase}
                    currentPlayer={state.currentPlayer}
                    stateForCaptures={state}
                  />
                </>
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
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => cancelGame()}
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70 transition-colors"
                    >
                      ✕ {t.cancelGame}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSurrenderConfirm(true)}
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-black hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    🏳️ {t.surrender}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center - Board */}
        <div className={`flex-1 min-h-0 items-center justify-center min-h-[240px] sm:min-h-[320px] md:min-h-[400px] overflow-hidden ${mobileTab === 'chat' ? 'hidden lg:flex' : 'flex flex-col'}`}>
          <HexBoard
            state={state}
            onRingClick={handleRingClick}
            selectedRingId={selectedRingId}
            highlightedCaptures={highlightedCaptures}
            validRemovableRings={validRemovableRings}
          />
          {/* Move history — mobile only, below board */}
          <div className={`lg:hidden w-full mt-2 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto ${mobileTab === 'chat' ? 'hidden' : ''}`}>
            <OnlineMoveHistory />
          </div>
        </div>

        {mobileTab === 'chat' && (
          <div className="lg:hidden fixed inset-x-0 z-10 flex flex-col p-2" style={{ top: '56px', bottom: '60px' }}>
            <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <ChatPanel />
            </div>
          </div>
        )}

        {/* Right panel - Chat (desktop, collapsible) */}
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
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel />
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 bg-white dark:bg-gray-800 rounded-xl p-1 shadow-lg border border-gray-200 dark:border-gray-700">
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

      {state.winner && !winnerModalDismissed && (
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
