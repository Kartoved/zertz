import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '../../store/roomStore';
import HexBoard from '../Board/HexBoard';
import { ChatPanel } from './ChatPanel';
import MarbleSelector from '../UI/MarbleSelector';
import { getValidRemovableRings } from '../../game/Board';

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const {
    state,
    playerNames,
    myPlayer,
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
    setPlayerName,
    reset,
  } = useRoomStore();

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

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMyTurn = () => {
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    return state.currentPlayer === myPlayerStr;
  };

  const getCurrentPlayerName = () => {
    return state.currentPlayer === 'player1' ? playerNames.player1 : playerNames.player2;
  };

  const getPhaseText = () => {
    if (state.winner) {
      const winnerName = state.winner === 'player1' ? playerNames.player1 : playerNames.player2;
      return `🏆 ${winnerName} победил!`;
    }
    if (state.phase === 'placement') return 'Размести шарик';
    if (state.phase === 'ringRemoval') return 'Удали кольцо';
    if (state.phase === 'capture') return 'Захвати шарик';
    return '';
  };

  const validRemovableRings = state.phase === 'ringRemoval' 
    ? getValidRemovableRings(state.rings) 
    : [];

  const handleRingClick = (ringId: string) => {
    if (!isMyTurn() || state.winner) return;

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
        <div className="text-xl text-gray-600 dark:text-gray-400">Загрузка...</div>
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
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm p-3 md:p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Меню
            </button>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-200">
              ZÈRTZ Online
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              {copied ? '✓ Скопировано!' : '🔗 Скопировать ссылку'}
            </button>
            <button
              onClick={() => setShowMobileChat(!showMobileChat)}
              className="md:hidden px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg"
            >
              💬
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-2 md:p-4 max-w-7xl mx-auto w-full">
        {/* Left panel - Players */}
        <div className="lg:w-64 flex lg:flex-col gap-2 lg:gap-4">
          {/* Player 1 */}
          <div className={`flex-1 p-3 rounded-lg ${
            state.currentPlayer === 'player1' && !state.winner
              ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500'
              : 'bg-white dark:bg-gray-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {myPlayer === 1 && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">Вы</span>}
              <input
                type="text"
                defaultValue={playerNames.player1}
                onBlur={(e) => handleNameEdit(1, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-b border-transparent 
                           hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full"
              />
            </div>
            <div className="flex gap-2 text-sm">
              <span>⚪ {state.captures.player1.white}</span>
              <span>🔘 {state.captures.player1.gray}</span>
              <span>⚫ {state.captures.player1.black}</span>
            </div>
          </div>

          {/* Player 2 */}
          <div className={`flex-1 p-3 rounded-lg ${
            state.currentPlayer === 'player2' && !state.winner
              ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500'
              : 'bg-white dark:bg-gray-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {myPlayer === 2 && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">Вы</span>}
              <input
                type="text"
                defaultValue={playerNames.player2}
                onBlur={(e) => handleNameEdit(2, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-b border-transparent 
                           hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full"
              />
            </div>
            <div className="flex gap-2 text-sm">
              <span>⚪ {state.captures.player2.white}</span>
              <span>🔘 {state.captures.player2.gray}</span>
              <span>⚫ {state.captures.player2.black}</span>
            </div>
          </div>

          {/* Status */}
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {isMyTurn() ? 'Ваш ход' : `Ход: ${getCurrentPlayerName()}`}
            </div>
            <div className="font-medium text-gray-800 dark:text-gray-200">
              {getPhaseText()}
            </div>
          </div>

          {/* Marble selector */}
          {isMyTurn() && state.phase === 'placement' && !state.winner && (
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Выбери шарик:</div>
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
        <div className="flex-1 flex items-center justify-center min-h-[300px] md:min-h-[400px]">
          <HexBoard
            state={state}
            onRingClick={handleRingClick}
            selectedRingId={selectedRingId}
            highlightedCaptures={highlightedCaptures}
            validRemovableRings={validRemovableRings}
          />
        </div>

        {/* Right panel - Chat (desktop, collapsible) */}
        <div className={`hidden lg:flex flex-col transition-all duration-300 ${
          chatCollapsed ? 'lg:w-12' : 'lg:w-80'
        }`}>
          <button
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className="mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
                       flex items-center justify-center transition-colors"
            title={chatCollapsed ? 'Развернуть чат' : 'Свернуть чат'}
          >
            {chatCollapsed ? '💬' : '→'}
          </button>
          {!chatCollapsed && (
            <div className="flex-1 h-[500px]">
              <ChatPanel />
            </div>
          )}
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
                <h3 className="font-semibold">Чат</h3>
                <button onClick={() => setShowMobileChat(false)} className="text-2xl">×</button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
