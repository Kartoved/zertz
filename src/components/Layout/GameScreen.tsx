import { useState } from 'react';
import HexBoard from '../Board/HexBoard';
import MarbleSelector from '../UI/MarbleSelector';
import GameStats from '../UI/GameStats';
import ControlPanel from '../UI/ControlPanel';
import MoveHistory from '../UI/MoveHistory';
import RulesContent from '../UI/RulesContent';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { getWinType } from '../../game/GameEngine';
import { getWinTypeLabel, useI18n } from '../../i18n';

interface LocalPlayerStripProps {
  slot: 'player1' | 'player2';
  isActive: boolean;
  captures: { white: number; gray: number; black: number };
  name: string;
  showActionsMenu: boolean;
  onOpenActions?: () => void;
}
function LocalPlayerStrip({ isActive, captures, name, showActionsMenu, onOpenActions }: LocalPlayerStripProps) {
  return (
    <div className={`lg:hidden flex items-center gap-2 px-3 py-1.5 ${
      isActive ? 'bg-blue-100 dark:bg-blue-900 ring-1 ring-blue-500' : 'bg-white dark:bg-gray-800'
    } border-b border-gray-200 dark:border-gray-700`}>
      <div className="flex gap-1 text-xs font-medium text-gray-800 dark:text-gray-200 flex-shrink-0">
        <span>⚪{captures.white}</span>
        <span>🔘{captures.gray}</span>
        <span>⚫{captures.black}</span>
      </div>
      <div className="flex-1 min-w-0 font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">{name}</div>
      {showActionsMenu && onOpenActions && (
        <button
          type="button"
          onClick={onOpenActions}
          className="flex-shrink-0 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          ⋯
        </button>
      )}
    </div>
  );
}

export default function GameScreen() {
  const { t } = useI18n();
  const { state, playerNames, newGame, cancelGame, botPlayer, isBotThinking } = useGameStore();
  const { toggleDarkMode, isDarkMode, setScreen } = useUIStore();
  const { user } = useAuthStore();
  const [showRematchDialog, setShowRematchDialog] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const { undo, currentNode } = useGameStore();
  const canCancelLocal = !state.winner && (state.moveNumber ?? 0) <= 2 && currentNode.children.length === 0;

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

  const handleMobileMenuAction = (tabId: string) => {
    setShowMobileMenu(false);
    if (tabId === 'rules') {
      setShowRulesModal(true);
      return;
    }
    setScreen('menu');
  };
  
  const isGameOver = state.phase === 'gameOver';
  const isCancelled = state.winner === 'cancelled';
  const winType = state.winner && !isCancelled ? getWinType(state, state.winner as import('../../game/types').Player) : null;
  const winnerName = isCancelled ? '' : (state.winner === 'player1' ? playerNames.player1 : playerNames.player2);
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm p-3 md:p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={() => setShowMobileMenu((prev) => !prev)}
              className="md:hidden px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg"
              title={showMobileMenu ? t.closeMenu : t.openMenu}
            >
              {showMobileMenu ? '✕' : '☰'}
            </button>
            <button
              onClick={() => setScreen('menu')}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← {t.roomMenu}
            </button>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-200">
              ZÈRTZ
            </h1>
          </div>

          <div className="hidden md:block flex-1 min-w-[220px] md:mx-3">
            <MoveHistory />
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setShowRulesModal(true)}
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              📘 {t.rules}
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

      {/* Mobile move history strip — mirrors the desktop header version. */}
      <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 py-1 overflow-x-auto">
        <MoveHistory />
      </div>

      {showMobileMenu && (
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
                  setShowMobileMenu(false);
                  setShowRulesModal(true);
                }}
                className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg"
              >
                📘 {t.rules}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 md:gap-4 p-2 md:p-4 max-w-7xl mx-auto w-full pb-28 sm:pb-24 lg:pb-4 overflow-y-auto">
        {/* Left panel - Stats and Controls (desktop only) */}
        <div className={`hidden lg:flex lg:w-64 lg:flex-col gap-2 lg:gap-4 min-w-0 ${isGameOver ? 'hidden lg:flex' : ''}`}>
          <GameStats compact={false} />

          {!isGameOver && (
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              {isBotThinking && botPlayer === state.currentPlayer ? (
                <div className="flex items-center gap-2 py-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
                  🤖 {t.botThinking}
                </div>
              ) : (
                <MarbleSelector />
              )}
              <div className="mt-3">
                <ControlPanel onSurrender={() => setShowSurrenderConfirm(true)} onCancel={cancelGame} />
              </div>
            </div>
          )}
        </div>

        {/* Board container — mobile: framed by compact strips; desktop: just the board */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Player 1 strip (mobile) */}
          <LocalPlayerStrip
            slot="player1"
            isActive={state.currentPlayer === 'player1' && !state.winner}
            captures={state.captures.player1}
            name={playerNames.player1}
            showActionsMenu={false}
          />
          <div className="flex-1 min-h-0 flex items-center justify-center p-2 lg:bg-white lg:dark:bg-gray-800 lg:rounded-xl shadow-sm overflow-hidden">
            <HexBoard />
          </div>
          {/* Player 2 strip + ⋯ menu (mobile) */}
          <LocalPlayerStrip
            slot="player2"
            isActive={state.currentPlayer === 'player2' && !state.winner}
            captures={state.captures.player2}
            name={playerNames.player2}
            showActionsMenu={true}
            onOpenActions={() => setShowMobileActions(true)}
          />
          {/* Marble picker (mobile, when placement phase) */}
          {!isGameOver && state.phase === 'placement' && (
            <div className="lg:hidden p-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              {isBotThinking && botPlayer === state.currentPlayer ? (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium animate-pulse">
                  🤖 {t.botThinking}
                </div>
              ) : (
                <MarbleSelector />
              )}
            </div>
          )}
        </div>

        {/* Empty right area to balance layout identical to online chat panel implicitly */}
        <div className="hidden lg:block lg:w-72 opacity-0 pointer-events-none"></div>
      </main>

      {/* Mobile actions sheet */}
      {showMobileActions && !isGameOver && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowMobileActions(false)}>
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-2xl shadow-2xl p-3 space-y-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { undo(); setShowMobileActions(false); }}
              disabled={!currentNode.parent}
              className="w-full px-3 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ↶ {t.undo}
            </button>
            {canCancelLocal && (
              <button
                type="button"
                onClick={() => { cancelGame(); setShowMobileActions(false); }}
                className="w-full px-3 py-2.5 text-sm rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70"
              >
                ✕ {t.cancelGame}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowMobileActions(false); setShowSurrenderConfirm(true); }}
              className="w-full px-3 py-2.5 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white"
            >
              🏳️ {t.surrender}
            </button>
            <button
              type="button"
              onClick={() => setShowMobileActions(false)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {isGameOver && (
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
                  🎉 {winnerName}!
                </div>
                <div className="text-base text-gray-700 dark:text-gray-300 mb-6">
                  {winType ? getWinTypeLabel(t, winType) : t.winUnknown}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowRematchDialog(true)}
                className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
              >
                {t.rematch}
              </button>
              <button
                onClick={() => setScreen('menu')}
                className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t.backToMenu}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRematchDialog && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.rematchChooseBoard}</h2>
              <button
                onClick={() => setShowRematchDialog(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              {([37, 48, 61] as const).map((boardSize) => (
                <button
                  key={boardSize}
                  onClick={() => {
                    newGame(boardSize);
                    setShowRematchDialog(false);
                  }}
                  className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {boardSize === 37 ? t.board37 : boardSize === 48 ? t.board48 : t.board61}
                </button>
              ))}
            </div>
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
                onClick={() => {
                  useGameStore.getState().surrender();
                  setShowSurrenderConfirm(false);
                }}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
              >
                {t.confirmAction}
              </button>
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.rules}</h2>
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
