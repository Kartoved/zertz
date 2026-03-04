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
import * as roomsApi from '../../db/roomsApi';
import { createInitialState } from '../../game/GameEngine';
import { GameNode } from '../../game/types';

type InviteMode = 'classic' | 'timedInvite';
type TimePresetId = '5+5' | '15+0' | '30+0';

const FISCHER_PRESETS: Array<{ id: TimePresetId; baseMs: number; incrementMs: number }> = [
  { id: '5+5', baseMs: 5 * 60 * 1000, incrementMs: 5 * 1000 },
  { id: '15+0', baseMs: 15 * 60 * 1000, incrementMs: 0 },
  { id: '30+0', baseMs: 30 * 60 * 1000, incrementMs: 0 },
];

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
  { id: 'blitz', icon: '⚡', enabled: true, preset: '5+5' as TimePresetId },
  { id: 'rapid', icon: '🏇', enabled: true, preset: '15+0' as TimePresetId },
  { id: 'long', icon: '⏳', enabled: true, preset: '30+0' as TimePresetId },
  { id: 'correspondence', icon: '∞', enabled: true, preset: null },
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
  const [onlineStep, setOnlineStep] = useState<'board' | 'time' | 'player' | 'link'>('board');
  const [inviteMode, setInviteMode] = useState<InviteMode>('classic');
  const [selectedBoardSize, setSelectedBoardSize] = useState<37 | 48 | 61>(37);
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | 'random'>(1);
  const [selectedPreset, setSelectedPreset] = useState<TimePresetId>('5+5');
  const [selectedTimeControl, setSelectedTimeControl] = useState<'blitz' | 'rapid' | 'long' | 'correspondence'>('blitz');
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mobileMainTab, setMobileMainTab] = useState<'play' | 'chat'>('play');
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [searchIntervalId, setSearchIntervalId] = useState<number | null>(null);

  const { user } = useAuthStore();
  const boardLabels: Record<number, string> = { 37: t.board37, 48: t.board48, 61: t.board61 };

  useEffect(() => {
    return () => {
      if (searchIntervalId) clearInterval(searchIntervalId);
    };
  }, [searchIntervalId]);

  const cancelSearch = async () => {
    if (searchIntervalId) clearInterval(searchIntervalId);
    setSearchIntervalId(null);
    setIsSearchingMatch(false);
    try {
      await roomsApi.leaveMatchmaking();
    } catch (e) { console.error('Error leaving search', e); }
  };
  
  useEffect(() => {
    refreshSavedGames();
  }, [refreshSavedGames]);
  
  const handleNewGame = () => {
    setShowBoardDialog(true);
  };

  const handleSelectBoard = (boardSize: 37 | 48 | 61) => {
    newGame(boardSize);
    navigate('/board');
    setShowBoardDialog(false);
  };
  
  const handleLoadGame = async (gameId: string) => {
    const game = savedGames.find(g => g.id === gameId);
    if (!game) return;

    await loadSavedGame(gameId);
    setShowLoadDialog(false);

    if (game.isOnline) {
      navigate(`/room/${gameId}`);
    } else {
      navigate('/board');
    }
  };

  const handleNavTab = (tab: NavTab) => {
    setShowMobileMenu(false);
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
  
  const currentGames = savedGames.filter(g => !g.winner);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      {/* ═══════ TOP NAV BAR ═══════ */}
      <header className="bg-white dark:bg-gray-800 shadow-md px-4 py-2 flex items-center justify-between relative z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">ZERTZ</h1>
        </div>

        {/* Nav tabs */}
        <nav className="hidden lg:flex items-center gap-1">
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
          {topExtraTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
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
          <button
            type="button"
            onClick={() => setShowMobileMenu((prev) => !prev)}
            className="lg:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            title={showMobileMenu ? t.closeMenu : t.openMenu}
          >
            {showMobileMenu ? '✕' : '☰'}
          </button>
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
              className="hidden sm:block px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {t.loginRegister}
            </button>
          )}
        </div>
      </header>

      {showMobileMenu && (
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
          {navTabs
            .filter((tab) => !tab.authOnly || user)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleNavTab(tab.id)}
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
          {!user && (
            <button
              onClick={() => {
                setShowMobileMenu(false);
                setShowAuthModal(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-500"
            >
              {t.loginRegister}
            </button>
          )}
        </div>
      )}

      {/* Searching Match Overlay */}
      {isSearchingMatch && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/20">
              <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]" />
            </div>
            
            <div className="w-20 h-20 mx-auto bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl animate-pulse">
                {TIME_CONTROLS.find(t => t.id === selectedTimeControl)?.icon || '🔍'}
              </span>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Searching for opponent...
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-8">
              {selectedBoardSize} rings / {TIME_CONTROLS.find(t => t.id === selectedTimeControl)?.id.toUpperCase()}
            </p>

            <button
              onClick={cancelSearch}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="lg:hidden px-3 pt-3">
        <div className="grid grid-cols-2 bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setMobileMainTab('play')}
            className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
              mobileMainTab === 'play'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t.tabPlay}
          </button>
          <button
            type="button"
            onClick={() => setMobileMainTab('chat')}
            className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
              mobileMainTab === 'chat'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {t.globalChat}
          </button>
        </div>
      </div>

      {/* ═══════ MAIN CONTENT: 3 columns ═══════ */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-3 md:p-4 overflow-visible lg:overflow-y-auto max-w-[1400px] mx-auto w-full">
        {/* LEFT: Player profile card */}
        <aside className="hidden lg:flex w-full lg:w-72 flex-shrink-0 flex-col order-2 lg:order-1 gap-4 items-start">
          <div className="w-full">
            <PlayerProfileCard
              onLoginClick={() => setShowAuthModal(true)}
            />
          </div>
          
          {/* Active Games Widget */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 flex flex-col w-full" style={{ maxHeight: '400px' }}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 px-1">{t.loadCurrent} ({currentGames.length})</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {currentGames.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">
                  {t.noGames}
                </p>
              ) : (
                currentGames.map(game => (
                  <button
                    key={game.id}
                    onClick={() => handleLoadGame(game.id)}
                    className="w-full p-2.5 text-left bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 
                      dark:hover:bg-gray-700 rounded-xl transition-colors border-2 border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm truncate pr-2">
                        <span className="truncate">{game.playerNames.player1}</span>
                        <span className="text-gray-400 text-xs font-normal relative top-[1px]">vs</span>
                        <span className="truncate">{game.playerNames.player2}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        game.isOnline 
                          ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800' 
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                      }`}>
                        {game.isOnline ? t.onlineLabel : t.localLabel}
                      </span>
                      <div className="text-[10px] text-gray-400 font-medium">
                        {game.moveCount} {t.moves.toLowerCase()}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* CENTER: Time control modes */}
        <section className={`flex-1 flex flex-col min-w-0 order-1 lg:order-2 ${mobileMainTab !== 'play' ? 'hidden lg:flex' : ''}`}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 flex-1 flex flex-col overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t.selectBoard}
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {([37, 48, 61] as const).map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedBoardSize(size)}
                  className={`py-3 rounded-xl font-bold bg-white dark:bg-gray-800 transition-colors border-2
                    ${selectedBoardSize === size 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-gray-900 dark:text-white shadow-sm' 
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  <div className="text-xl mb-1">{size}</div>
                  <div className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    {boardLabels[size]}
                  </div>
                </button>
              ))}
            </div>

            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              {t.selectTimeControl}
            </h2>

            {/* Optional generic button for inviting (hidden as we use direct buttons now) */}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {TIME_CONTROLS.map((tc) => {
                const label = t[tc.id as keyof typeof t] as string || tc.id;
                const desc = t[`${tc.id}Desc` as keyof typeof t] as string || '';
                return (
                  <button
                    key={tc.id}
                    disabled={!tc.enabled || (!user && tc.preset !== null)}
                    onClick={() => {
                      if (!user && tc.preset !== null) {
                        setShowAuthModal(true);
                        return;
                      }
                      setSelectedTimeControl(tc.id as any);
                    }}
                    className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all
                      ${(!tc.enabled || (!user && tc.preset !== null))
                        ? 'border-dashed border-gray-300 dark:border-gray-600 opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
                        : selectedTimeControl === tc.id
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 ring-2 ring-indigo-500/50 scale-[1.02] shadow-md'
                          : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800'
                      }`}
                  >
                    {!tc.enabled && (
                      <span className="absolute top-3 right-3 text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                        {t.comingSoon}
                      </span>
                    )}
                    <span className={`text-4xl mb-3 ${selectedTimeControl === tc.id ? 'scale-110' : ''} transition-transform`}>{tc.icon}</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                      {label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center font-medium">
                      {desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col gap-3 items-center">
              <button
                type="button"
                className="w-full sm:w-2/3 lg:w-1/2 py-3.5 px-6 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-95 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                onClick={async () => {
                  const tc = TIME_CONTROLS.find(c => c.id === selectedTimeControl);
                  if (!tc) return;
                  if (!user && tc.preset !== null) {
                    setShowAuthModal(true);
                    return;
                  }
                  if (tc.preset === null) return; // Correspondence matchmaking isn't fully supported

                  // Start searching logic
                  setIsSearchingMatch(true);

                  const initialState = createInitialState(selectedBoardSize);
                  const rootNode: GameNode = {
                    id: 'root',
                    moveNumber: 0,
                    player: 'player1',
                    move: null,
                    notation: '',
                    children: [],
                    parent: null,
                    isMainLine: true,
                  };
                  
                  try {
                    const res = await roomsApi.joinMatchmaking(selectedBoardSize, tc.id, initialState, rootNode);
                    if (res.status === 'matched' && res.roomId) {
                      // Immediately matched
                      setIsSearchingMatch(false);
                      navigate(`/room/${res.roomId}`);
                    } else {
                      // Polling
                      const interval = window.setInterval(async () => {
                        try {
                          const pollRes = await roomsApi.pollMatchStatus();
                          if (pollRes.status === 'matched' && pollRes.roomId) {
                            clearInterval(interval);
                            setIsSearchingMatch(false);
                            setSearchIntervalId(null);
                            navigate(`/room/${pollRes.roomId}`);
                          }
                        } catch (e) {
                          console.error('Polling error', e);
                        }
                      }, 1500);
                      setSearchIntervalId(interval);
                    }
                  } catch (err) {
                    console.error('Error joining match', err);
                    setIsSearchingMatch(false);
                  }
                }}
              >
                {t.searchGame}
              </button>

              <button
                type="button"
                className="w-full sm:w-2/3 lg:w-1/2 py-3.5 px-6 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-95 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => {
                  const tc = TIME_CONTROLS.find(c => c.id === selectedTimeControl);
                  if (!tc) return;

                  if (tc.preset === null) {
                    setInviteMode('classic');
                    setOnlineStep('board');
                    setShowOnlineDialog(true);
                  } else {
                    setInviteMode('timedInvite');
                    setSelectedPreset(tc.preset);
                    setOnlineStep('board');
                    setShowOnlineDialog(true);
                  }
                }}
              >
                {t.playByLink}
              </button>
            </div>

          </div>

          {/* Footer */}
          <div className="mt-3 text-xs text-gray-400 dark:text-gray-500 text-center leading-5">
            <div>
              <span>{t.versionFooter}</span>
              <span className="mx-2">·</span>
              <span>{t.developedBy}</span>
            </div>
            <div>{t.zertzByKrisBurm}</div>
          </div>
        </section>

        {/* RIGHT: Global chat */}
        <aside className={`w-full lg:w-80 flex-shrink-0 flex-col order-3 ${mobileMainTab === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
          <GlobalChat />
        </aside>
      </main>
      
      {showLoadDialog && (() => {
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
                {onlineStep === 'time' && t.selectTimeControl}
                {onlineStep === 'player' && t.choosePlayer}
                {onlineStep === 'link' && t.inviteLinkTitle}
              </h2>
              <button
                onClick={() => {
                  setShowOnlineDialog(false);
                  setInviteMode('classic');
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
                          setOnlineStep(inviteMode === 'timedInvite' ? 'time' : 'player');
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

              {onlineStep === 'time' && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {t.selectTimeControl}
                  </p>
                  <div className="space-y-3">
                    {FISCHER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedPreset(preset.id)}
                        className={`w-full p-3 text-left rounded-lg transition-colors ${
                          selectedPreset === preset.id
                            ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className="font-medium">{preset.id}</div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setOnlineStep('board')}
                      className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white 
                        rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      {t.back}
                    </button>
                    <button
                      onClick={() => setOnlineStep('player')}
                      className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold 
                        rounded-lg transition-colors"
                    >
                      Далее
                    </button>
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
                      onClick={() => setOnlineStep(inviteMode === 'timedInvite' ? 'time' : 'board')}
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
                          const preset = FISCHER_PRESETS.find((p) => p.id === selectedPreset) || FISCHER_PRESETS[0];
                          const roomId = await createRoom(
                            selectedBoardSize,
                            player,
                            isRated,
                            inviteMode === 'timedInvite'
                              ? { baseMs: preset.baseMs, incrementMs: preset.incrementMs }
                              : null
                          );
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
                        setInviteMode('classic');
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
