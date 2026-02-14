import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, Language } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { getWinTypeLabel, useI18n } from '../../i18n';
import AuthModal from '../Auth/AuthModal';
import ProfileModal from '../Auth/ProfileModal';
import PlayersModal from '../Auth/PlayersModal';
import ChallengesModal from '../Auth/ChallengesModal';
import PlayerProfileCard from '../UI/PlayerProfileCard';
import GlobalChat from '../UI/GlobalChat';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const LANGUAGE_BUTTONS: Array<{ code: Language; icon: string; label: string }> = [
  { code: 'en', icon: '🇬🇧', label: 'English' },
  { code: 'ru', icon: '🇷🇺', label: 'Russian' },
  { code: 'eo', icon: '🟢', label: 'Esperanto' },
];

const TIME_CONTROLS = [
  { id: 'blitz', icon: '⚡', enabled: false },
  { id: 'rapid', icon: '🏇', enabled: false },
  { id: 'correspondence', icon: '∞', enabled: true },
] as const;

type NavTab = 'playOnline' | 'playLocal' | 'loadGame' | 'rules' | 'players' | 'challenges';

export default function MainMenu() {
  const navigate = useNavigate();
  const { setScreen, toggleDarkMode, isDarkMode, language, setLanguage } = useUIStore();
  const { t } = useI18n();
  const { newGame, savedGames, refreshSavedGames, loadSavedGame } = useGameStore();
  const { createRoom, isLoading: isCreatingRoom } = useRoomStore();
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showBoardDialog, setShowBoardDialog] = useState(false);
  const [showOnlineDialog, setShowOnlineDialog] = useState(false);
  const [onlineStep, setOnlineStep] = useState<'board' | 'player' | 'link'>('board');
  const [selectedBoardSize, setSelectedBoardSize] = useState<37 | 48 | 61>(37);
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | 'random'>(1);
  const [createdRoomId, setCreatedRoomId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [isRated, setIsRated] = useState(false);
  const [loadTab, setLoadTab] = useState<'current' | 'completed'>('current');
  const [loadFilter, setLoadFilter] = useState<'all' | 'local' | 'online'>('all');
  const [showChallengesModal, setShowChallengesModal] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const { user } = useAuthStore();
  const boardLabels: Record<number, string> = { 37: t.board37, 48: t.board48, 61: t.board61 };
  
  useEffect(() => {
    refreshSavedGames();
  }, [refreshSavedGames]);
  
  const handleNewGame = () => {
    setShowBoardDialog(true);
  };

  const handleSelectBoard = (boardSize: 37 | 48 | 61) => {
    newGame(boardSize);
    setShowBoardDialog(false);
    setScreen('game');
  };
  
  const handleLoadGame = async (gameId: string) => {
    await loadSavedGame(gameId);
    setShowLoadDialog(false);
    setScreen('game');
  };

  const handleNavTab = (tab: NavTab) => {
    switch (tab) {
      case 'playOnline': setShowOnlineDialog(true); break;
      case 'playLocal': handleNewGame(); break;
      case 'loadGame': setShowLoadDialog(true); break;
      case 'rules': setScreen('rules'); break;
      case 'players': setShowPlayersModal(true); break;
      case 'challenges': setShowChallengesModal(true); break;
    }
  };

  const navTabs: Array<{ id: NavTab; label: string; authOnly?: boolean }> = [
    { id: 'playOnline', label: t.playOnline },
    { id: 'playLocal', label: t.playLocal },
    { id: 'loadGame', label: t.loadGame },
    { id: 'rules', label: t.rules },
    { id: 'players', label: t.players },
    { id: 'challenges', label: t.challenges, authOnly: true },
  ];
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      {/* ═══════ TOP NAV BAR ═══════ */}
      <header className="bg-white dark:bg-gray-800 shadow-md px-4 py-2 flex items-center justify-between relative z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">ZERTZ</h1>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1">
          {navTabs
            .filter((tab) => !tab.authOnly || user)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleNavTab(tab.id)}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                  text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
                  hover:text-gray-900 dark:hover:text-white uppercase tracking-wide"
              >
                {tab.label}
              </button>
            ))}
        </nav>

        {/* Right: language, dark mode, user */}
        <div className="flex items-center gap-2 flex-shrink-0 relative">
          {/* Language dropdown */}
          <button
            onClick={() => setShowLanguageDropdown((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-semibold text-gray-800 dark:text-white"
            title="Language"
          >
            {LANGUAGE_BUTTONS.find((b) => b.code === language)?.icon ?? '🌐'}
          </button>
          {showLanguageDropdown && (
            <div className="absolute top-10 right-16 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex gap-2">
              {LANGUAGE_BUTTONS.map((btn) => (
                <button
                  key={btn.code}
                  type="button"
                  onClick={() => {
                    setLanguage(btn.code);
                    setShowLanguageDropdown(false);
                  }}
                  className={`px-2 py-1 rounded-md text-sm transition-colors ${language === btn.code ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                  title={btn.label}
                >
                  {btn.icon}
                </button>
              ))}
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={isDarkMode ? t.lightMode : t.darkMode}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>

          {/* User avatar / login */}
          {user ? (
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
                {user.username}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {t.loginRegister}
            </button>
          )}
        </div>
      </header>

      {/* ═══════ MAIN CONTENT: 3 columns ═══════ */}
      <main className="flex-1 flex gap-4 p-4 overflow-hidden max-w-[1400px] mx-auto w-full">
        {/* LEFT: Player profile card */}
        <aside className="w-72 flex-shrink-0 hidden lg:flex flex-col">
          <PlayerProfileCard
            onLoginClick={() => setShowAuthModal(true)}
            onProfileClick={() => setShowProfileModal(true)}
          />
        </aside>

        {/* CENTER: Time control modes */}
        <section className="flex-1 flex flex-col min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 flex-1 flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              {t.selectTimeControl}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
              {TIME_CONTROLS.map((tc) => {
                const label = t[tc.id as keyof typeof t] as string;
                const desc = t[`${tc.id}Desc` as keyof typeof t] as string;
                return (
                  <button
                    key={tc.id}
                    disabled={!tc.enabled}
                    onClick={() => {
                      if (tc.id === 'correspondence') {
                        setShowOnlineDialog(true);
                      }
                    }}
                    className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all
                      ${tc.enabled
                        ? 'border-gray-200 dark:border-gray-600 hover:border-teal-500 dark:hover:border-teal-400 hover:shadow-lg cursor-pointer bg-white dark:bg-gray-700'
                        : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
                      }`}
                  >
                    {!tc.enabled && (
                      <span className="absolute top-3 right-3 text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                        {t.comingSoon}
                      </span>
                    )}
                    <span className="text-4xl mb-3">{tc.icon}</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                      {label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick action buttons row */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm"
              >
                {t.tasks}
              </button>
              <button
                type="button"
                className="py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm"
              >
                {t.community}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 text-center">
            <span>{t.versionFooter}</span>
            <span className="mx-2">·</span>
            <span>{t.developedBy}</span>
          </div>
        </section>

        {/* RIGHT: Global chat */}
        <aside className="w-80 flex-shrink-0 hidden lg:flex flex-col">
          <GlobalChat />
        </aside>
      </main>
      
      {showLoadDialog && (() => {
        const currentGames = savedGames.filter(g => !g.winner);
        const completedGames = savedGames.filter(g => !!g.winner);
        const tabGames = loadTab === 'current' ? currentGames : completedGames;
        const filteredGames = loadFilter === 'all' ? tabGames
          : loadFilter === 'local' ? tabGames.filter(g => !g.isOnline)
          : tabGames.filter(g => g.isOnline);

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.loadGame}</h2>
                <button 
                  onClick={() => setShowLoadDialog(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              {/* Tabs */}
              <div className="flex border-b dark:border-gray-700">
                <button
                  onClick={() => setLoadTab('current')}
                  className={`flex-1 py-2 px-4 text-center text-sm font-semibold transition-colors ${
                    loadTab === 'current'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {t.loadCurrent} ({currentGames.length})
                </button>
                <button
                  onClick={() => setLoadTab('completed')}
                  className={`flex-1 py-2 px-4 text-center text-sm font-semibold transition-colors ${
                    loadTab === 'completed'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {t.loadCompleted} ({completedGames.length})
                </button>
              </div>
              {/* Filters */}
              <div className="flex gap-1 px-4 pt-3">
                {(['all', 'local', 'online'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setLoadFilter(f)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      loadFilter === f
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all' ? t.filterAll : f === 'local' ? t.filterLocal : t.filterOnline}
                  </button>
                ))}
              </div>
              <div className="p-4 overflow-y-auto max-h-96">
                {filteredGames.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    {t.noGames}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredGames.map(game => (
                      <button
                        key={game.id}
                        onClick={() => handleLoadGame(game.id)}
                        className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                          dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              {game.playerNames.player1} vs {game.playerNames.player2}
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                game.isOnline 
                                  ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300' 
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                              }`}>
                                {game.isOnline ? t.onlineLabel : t.localLabel}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {t.moves}: {game.moveCount} • {t.board}: {boardLabels[game.boardSize] ?? `${game.boardSize}`}
                            </div>
                            {game.winType && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {getWinTypeLabel(t, game.winType)}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-medium ${
                              game.winner ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                            }`}>
                              {game.winner ? `${game.winner === 'player1' ? game.playerNames.player1 : game.playerNames.player2}` : t.inProgress}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatDate(game.updatedAt)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showBoardDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.chooseBoard}</h2>
              <button
                onClick={() => setShowBoardDialog(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => handleSelectBoard(37)}
                className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                  dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {t.board37}
              </button>
              <button
                onClick={() => handleSelectBoard(48)}
                className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                  dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {t.board48}
              </button>
              <button
                onClick={() => handleSelectBoard(61)}
                className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                  dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {t.board61}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnlineDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {onlineStep === 'board' && t.chooseBoardOnline}
                {onlineStep === 'player' && t.choosePlayer}
                {onlineStep === 'link' && t.inviteLinkTitle}
              </h2>
              <button
                onClick={() => {
                  setShowOnlineDialog(false);
                  setOnlineStep('board');
                  setCreatedRoomId(null);
                  setLinkCopied(false);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {onlineStep === 'board' && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {t.onlineBoardPrompt}
                  </p>
                  <div className="space-y-3">
                    {([37, 48, 61] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setSelectedBoardSize(size);
                          setOnlineStep('player');
                        }}
                        className={`w-full p-3 text-left rounded-lg transition-colors ${
                          selectedBoardSize === size
                            ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {boardLabels[size]}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {onlineStep === 'player' && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {t.playerPrompt}
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedPlayer(1)}
                      className={`w-full p-3 text-left rounded-lg transition-colors ${
                        selectedPlayer === 1
                          ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="font-medium">{t.playerFirst}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{t.playerFirstHint}</div>
                    </button>
                    <button
                      onClick={() => setSelectedPlayer(2)}
                      className={`w-full p-3 text-left rounded-lg transition-colors ${
                        selectedPlayer === 2
                          ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="font-medium">{t.playerSecond}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{t.playerSecondHint}</div>
                    </button>
                    <button
                      onClick={() => setSelectedPlayer('random')}
                      className={`w-full p-3 text-left rounded-lg transition-colors ${
                        selectedPlayer === 'random'
                          ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="font-medium">{t.playerRandom}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{t.playerRandomHint}</div>
                    </button>
                  </div>

                  {/* Rated toggle — only for authenticated users */}
                  {user && (
                    <div className="flex items-center justify-between mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">{t.ratedGame}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{t.ratedHint}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRated(!isRated)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          isRated ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          isRated ? 'translate-x-6' : ''
                        }`} />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setOnlineStep('board')}
                      className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white 
                        rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      {t.back}
                    </button>
                    <button
                      disabled={isCreatingRoom}
                      onClick={async () => {
                        try {
                          const player = selectedPlayer === 'random' 
                            ? (Math.random() < 0.5 ? 1 : 2) 
                            : selectedPlayer;
                          const roomId = await createRoom(selectedBoardSize, player, isRated);
                          setCreatedRoomId(roomId);
                          setOnlineStep('link');
                        } catch {
                          alert(t.createRoomError);
                        }
                      }}
                      className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold 
                        rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isCreatingRoom ? t.creating : t.createGame}
                    </button>
                  </div>
                </>
              )}

              {onlineStep === 'link' && createdRoomId && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {t.gameCreatedHint}
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t.gameLink}</div>
                    <a 
                      href={`${window.location.origin}/room/${createdRoomId}`}
                      className="text-purple-600 dark:text-purple-400 hover:underline break-all font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {window.location.origin}/room/{createdRoomId}
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/room/${createdRoomId}`);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white 
                        rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      {linkCopied ? t.copied : t.copyLink}
                    </button>
                    <button
                      onClick={() => {
                        setShowOnlineDialog(false);
                        setOnlineStep('board');
                        navigate(`/room/${createdRoomId}`);
                      }}
                      className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold 
                        rounded-lg transition-colors"
                    >
                      {t.goToGame}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
      {showPlayersModal && <PlayersModal onClose={() => setShowPlayersModal(false)} />}
      {showChallengesModal && <ChallengesModal onClose={() => setShowChallengesModal(false)} />}
    </div>
  );
}
