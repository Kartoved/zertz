import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
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
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [mobileTab, setMobileTab] = useState<'board' | 'players'>('board');
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [winnerModalDismissed, setWinnerModalDismissed] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const {
    state,
    playerNames,
    myPlayer,
    user1Id,
    user2Id,
    isLoading,
    error,
    joinRoom,
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
    undoLastMove,
    currentNode,
    setPlayerName,
    reset,
    rated,
    user1Rating,
    user2Rating,
    ratingDelta,
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

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMyTurn = () => {
    if (!myPlayer) return false;
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    return state.currentPlayer === myPlayerStr;
  };

  const getPhaseText = () => {
    if (state.phase === 'placement') return t.phasePlacement;
    if (state.phase === 'ringRemoval') return t.phaseRingRemoval;
    if (state.phase === 'capture') return t.phaseCapture;
    return '';
  };

  const winnerName = state.winner === 'player1' ? playerNames.player1 : playerNames.player2;
  const winnerWinType = state.winner ? getWinType(state, state.winner) : null;

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
    <div className="h-screen bg-gray-100 dark:bg-gray-900 flex flex-col overflow-hidden">
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
              onClick={() => setShowMobileChat(!showMobileChat)}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg"
            >
              💬
            </button>
          </div>
        </div>
      </header>

      {showMobileHeaderMenu && (
        <div className="md:hidden px-3 pb-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <OnlineMoveHistory />
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
                  setShowMobileChat(true);
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
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-2 md:p-4 max-w-7xl mx-auto w-full pb-16 lg:pb-4">
        {/* Left panel - Players */}
        <div className={`lg:w-64 lg:flex lg:flex-col gap-2 lg:gap-4 ${mobileTab !== 'players' ? 'hidden lg:flex' : 'flex flex-col'}`}>
          {/* Player 1 */}
          <div className={`flex-1 p-3 rounded-lg ${
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
                  {playerNames.player1}
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
            {ratingDelta && state.winner && rated && (
              <div className="text-xs mb-1">
                <span className="text-gray-500">{ratingDelta.player1.before} → {ratingDelta.player1.after}</span>
                <span className={`ml-1 font-bold ${ratingDelta.player1.delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {ratingDelta.player1.delta >= 0 ? '+' : ''}{ratingDelta.player1.delta}
                </span>
              </div>
            )}
            <div className="flex gap-2 text-sm">
              <span>⚪ {state.captures.player1.white}</span>
              <span>🔘 {state.captures.player1.gray}</span>
              <span>⚫ {state.captures.player1.black}</span>
            </div>
            {state.currentPlayer === 'player1' && !state.winner && (
              <div className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-200">
                <div>{myPlayer === 1 ? t.yourTurn : t.opponentTurn}</div>
                <div className="text-xs text-blue-600/90 dark:text-blue-300/90">{getPhaseText()}</div>
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div className={`flex-1 p-3 rounded-lg ${
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
                  {playerNames.player2}
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
            {ratingDelta && state.winner && rated && (
              <div className="text-xs mb-1">
                <span className="text-gray-500">{ratingDelta.player2.before} → {ratingDelta.player2.after}</span>
                <span className={`ml-1 font-bold ${ratingDelta.player2.delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {ratingDelta.player2.delta >= 0 ? '+' : ''}{ratingDelta.player2.delta}
                </span>
              </div>
            )}
            <div className="flex gap-2 text-sm">
              <span>⚪ {state.captures.player2.white}</span>
              <span>🔘 {state.captures.player2.gray}</span>
              <span>⚫ {state.captures.player2.black}</span>
            </div>
            {state.currentPlayer === 'player2' && !state.winner && (
              <div className="mt-2 text-sm font-medium text-blue-700 dark:text-blue-200">
                <div>{myPlayer === 2 ? t.yourTurn : t.opponentTurn}</div>
                <div className="text-xs text-blue-600/90 dark:text-blue-300/90">{getPhaseText()}</div>
              </div>
            )}
          </div>

          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
            <button
              type="button"
              onClick={() => void undoLastMove()}
              disabled={!myPlayer || !currentNode.parent || !!state.winner || !isMyTurn()}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↶ {t.undoMove}
            </button>
          </div>

          {/* Marble selector */}
          {state.phase === 'placement' && !state.winner && (
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t.chooseMarbleShort}</div>
              <MarbleSelector
                reserve={state.reserve}
                selectedColor={selectedMarbleColor}
                onSelect={selectMarbleColor}
                captures={state.captures[state.currentPlayer]}
                phase={state.phase}
                currentPlayer={state.currentPlayer}
                stateForCaptures={state}
              />
            </div>
          )}
        </div>

        {/* Center - Board */}
        <div className={`flex-1 min-h-0 items-center justify-center min-h-[320px] md:min-h-[400px] ${mobileTab !== 'board' ? 'hidden lg:flex' : 'flex'}`}>
          <HexBoard
            state={state}
            onRingClick={handleRingClick}
            selectedRingId={selectedRingId}
            highlightedCaptures={highlightedCaptures}
            validRemovableRings={validRemovableRings}
          />
        </div>

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
            <div className="flex-1 min-h-0 h-[500px] max-h-full overflow-hidden">
              <ChatPanel />
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3">
        <div className="grid grid-cols-3 bg-white dark:bg-gray-800 rounded-xl p-1 shadow-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setMobileTab('board')}
            className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
              mobileTab === 'board'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t.tabBoard}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('players')}
            className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
              mobileTab === 'players'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t.tabPlayers}
          </button>
          <button
            type="button"
            onClick={() => setShowMobileChat(true)}
            className="py-2 text-sm font-semibold rounded-lg text-white bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            {t.chat}
          </button>
        </div>
      </div>

      {/* Mobile chat overlay */}
      {showMobileChat && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={() => setShowMobileChat(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 h-[70vh] bg-white dark:bg-gray-800 rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold">{t.chat}</h3>
                <button onClick={() => setShowMobileChat(false)} className="text-2xl">×</button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel />
              </div>
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
            <div className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
              🏆 {winnerName}
            </div>
            <div className="text-gray-600 dark:text-gray-300 mb-1">{t.gameOver}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {getWinTypeLabel(t, winnerWinType)}
            </div>
            <button
              onClick={() => setWinnerModalDismissed(true)}
              className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
            >
              {t.close}
            </button>
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
