import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, Language } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import AuthModal from '../Auth/AuthModal';
import ProfileModal from '../Auth/ProfileModal';
import PlayersModal from '../Auth/PlayersModal';
import ChallengesModal from '../Auth/ChallengesModal';
import PlayerProfileCard from '../UI/PlayerProfileCard';
import GlobalChat from '../UI/GlobalChat';
import { Settings, Users, Swords } from 'lucide-react';
import LoadGameModal from './LoadGameModal';
import RulesModal from './RulesModal';
import BoardSelectionModal from './BoardSelectionModal';
import SearchingMatchOverlay from './SearchingMatchOverlay';
import OnlineChallengeModal from './OnlineChallengeModal';
import ActiveGamesWidget from './ActiveGamesWidget';
import { useMainMenuModals, NavTab } from './useMainMenuModals';
import { useMatchmaking } from './useMatchmaking';

export type TimePresetId = '5+5' | '15+0' | '30+0' | '7d';

export const FISCHER_PRESETS: Array<{ id: TimePresetId; baseMs: number; incrementMs: number }> = [
  { id: '5+5', baseMs: 5 * 60 * 1000, incrementMs: 5 * 1000 },
  { id: '15+0', baseMs: 15 * 60 * 1000, incrementMs: 0 },
  { id: '30+0', baseMs: 30 * 60 * 1000, incrementMs: 0 },
  { id: '7d', baseMs: 7 * 24 * 60 * 60 * 1000, incrementMs: -1 },
];

const LANGUAGE_BUTTONS: Array<{ code: Language; icon: string; label: string }> = [
  { code: 'en', icon: '🇬🇧', label: 'English' },
  { code: 'ru', icon: '🇷🇺', label: 'Russian' },
  { code: 'eo', icon: '🟢', label: 'Esperanto' },
];

export const TIME_CONTROLS = [
  { id: 'blitz', icon: '⚡', enabled: true, preset: '5+5' as TimePresetId },
  { id: 'rapid', icon: '🏇', enabled: true, preset: '15+0' as TimePresetId },
  { id: 'long', icon: '⏳', enabled: true, preset: '30+0' as TimePresetId },
  { id: 'correspondence', icon: '∞', enabled: true, preset: '7d' as TimePresetId },
] as const;

export default function MainMenu() {
  const navigate = useNavigate();
  const { setScreen, toggleDarkMode, isDarkMode, language, setLanguage } = useUIStore();
  const { t } = useI18n();
  const { newGame, savedGames, refreshSavedGames, loadSavedGame } = useGameStore();

  const modals = useMainMenuModals();
  const { isSearchingMatch, cancelSearch, startSearch } = useMatchmaking();

  const [selectedBoardSize, setSelectedBoardSize] = useState<37 | 48 | 61>(37);
  const [selectedPreset, setSelectedPreset] = useState<TimePresetId>('5+5');
  const [selectedTimeControl, setSelectedTimeControl] = useState<'blitz' | 'rapid' | 'long' | 'correspondence'>('blitz');
  const [mobileMainTab, setMobileMainTab] = useState<'play' | 'chat'>('play');

  const { user, fetchMe } = useAuthStore();
  const boardLabels: Record<number, string> = { 37: t.board37, 48: t.board48, 61: t.board61 };

  useEffect(() => {
    refreshSavedGames();
    fetchMe();
  }, [refreshSavedGames, fetchMe, user?.id]);

  const handleSelectBoard = (boardSize: 37 | 48 | 61) => {
    newGame(boardSize);
    setScreen('game');
    modals.setShowBoardDialog(false);
  };

  const handleLoadGame = async (gameId: string) => {
    const game = savedGames.find(g => g.id === gameId);
    if (!game) return;

    await loadSavedGame(gameId);
    modals.setShowLoadDialog(false);

    if (game.isOnline) {
      navigate(`/room/${gameId}`);
    } else {
      setScreen('game');
    }
  };

  const [activeDropdown, setActiveDropdown] = useState<'play' | 'learning' | 'community' | 'settings' | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.nav-dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navTabs: Array<{ id: NavTab; label: string; authOnly?: boolean }> = [
    { id: 'playLocal', label: t.playLocal },
    { id: 'loadGame', label: t.loadGame },
    { id: 'rules', label: t.rules },
    { id: 'players', label: t.players },
    { id: 'challenges', label: t.challenges, authOnly: true },
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

        {/* Nav tabs (Dropdowns) */}
        <nav className="hidden lg:flex items-center gap-4 ml-6 nav-dropdown-container">
          {/* PLAY */}
          <div className="relative group">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'play' ? null : 'play')}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
                hover:text-gray-900 dark:hover:text-white uppercase tracking-wide flex items-center gap-1"
            >
              {t.tabMainPlay}
              <span className="text-[10px] opacity-70">▼</span>
            </button>
            {activeDropdown === 'play' && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => { modals.handleNavTab('playLocal'); setActiveDropdown(null); }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t.playLocal}
                </button>
                <button
                  onClick={() => { modals.handleNavTab('loadGame'); setActiveDropdown(null); }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t.loadGame}
                </button>
              </div>
            )}
          </div>

          {/* LEARNING */}
          <div className="relative group">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'learning' ? null : 'learning')}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
                hover:text-gray-900 dark:hover:text-white uppercase tracking-wide flex items-center gap-1"
            >
              {t.tabMainLearning}
              <span className="text-[10px] opacity-70">▼</span>
            </button>
            {activeDropdown === 'learning' && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => { modals.handleNavTab('rules'); setActiveDropdown(null); }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t.rules}
                </button>
                <button
                  onClick={() => { setActiveDropdown(null); }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-not-allowed"
                >
                  {t.tasks} ({t.comingSoon})
                </button>
              </div>
            )}
          </div>

          {/* COMMUNITY */}
          <div className="relative group">
            <button
              onClick={() => setActiveDropdown(activeDropdown === 'community' ? null : 'community')}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
                hover:text-gray-900 dark:hover:text-white uppercase tracking-wide flex items-center gap-1"
            >
              {t.tabMainCommunity}
              <span className="text-[10px] opacity-70">▼</span>
            </button>
            {activeDropdown === 'community' && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => { modals.handleNavTab('players'); setActiveDropdown(null); }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t.players}
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="flex-1" />

        {/* Right: User icons */}
        <div className="flex items-center gap-2 flex-shrink-0 relative">
          <button
            type="button"
            onClick={() => modals.setShowMobileMenu((prev) => !prev)}
            className="lg:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            title={modals.showMobileMenu ? t.closeMenu : t.openMenu}
          >
            {modals.showMobileMenu ? '✕' : '☰'}
          </button>

          {/* Settings Icon (Language & Theme) */}
          <div className="relative nav-dropdown-container">
            <button
               onClick={() => setActiveDropdown(activeDropdown === 'settings' ? null : 'settings')}
               className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
               title={t.settings}
            >
              <Settings size={20} />
            </button>
            
            {activeDropdown === 'settings' && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 mb-1">
                  {t.language}
                </div>
                <div className="flex justify-around px-2 mb-2">
                  {LANGUAGE_BUTTONS.map((btn) => (
                    <button
                      key={btn.code}
                      onClick={() => setLanguage(btn.code)}
                      className={`p-2 rounded-lg text-lg transition-colors ${language === btn.code ? 'bg-indigo-100 dark:bg-indigo-900 shadow-inner' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      title={btn.label}
                    >
                      {btn.icon}
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 mt-1 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isDarkMode ? t.lightMode : t.darkMode}
                  </span>
                  <button
                    onClick={toggleDarkMode}
                    className="p-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {isDarkMode ? '☀️' : '🌙'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {user && (
            <>
              {/* Friends (placeholder for now) */}
              <button
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={t.friends}
                onClick={() => modals.handleNavTab('players')}
              >
                <Users size={20} />
              </button>
              {/* Challenges */}
              <button
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={t.challenges}
                onClick={() => modals.handleNavTab('challenges')}
              >
                <Swords size={20} />
              </button>
            </>
          )}

          {/* User avatar / login */}
          {user ? (
            <button
              onClick={() => modals.setShowProfileModal(true)}
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
              onClick={() => modals.setShowAuthModal(true)}
              className="hidden sm:block px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {t.loginRegister}
            </button>
          )}
        </div>
      </header>

      {modals.showMobileMenu && (
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
          {navTabs
            .filter((tab) => !tab.authOnly || user)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => modals.handleNavTab(tab.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700"
              >
                {tab.label}
              </button>
            ))}
          {!user && (
            <button
              onClick={() => {
                modals.setShowMobileMenu(false);
                modals.setShowAuthModal(true);
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
        <SearchingMatchOverlay
          onCancel={cancelSearch}
          icon={TIME_CONTROLS.find(t => t.id === selectedTimeControl)?.icon || '🔍'}
          timeControlId={TIME_CONTROLS.find(t => t.id === selectedTimeControl)?.id.toUpperCase() || ''}
          boardSize={selectedBoardSize}
        />
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
              onLoginClick={() => modals.setShowAuthModal(true)}
            />
          </div>
          
          <ActiveGamesWidget
            currentGames={currentGames}
            user={user}
            onLoadGame={handleLoadGame}
          />
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
                  <div className="text-xl mb-1">
                    {size === 37 ? t.boardSizeSmall : size === 48 ? t.boardSizeMedium : t.boardSizeLarge}
                  </div>
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
                        modals.setShowAuthModal(true);
                        return;
                      }
                      setSelectedTimeControl(tc.id);
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
                onClick={() => startSearch(selectedBoardSize, selectedTimeControl, () => modals.setShowAuthModal(true))}
              >
                {t.searchGame}
              </button>

              <button
                type="button"
                className="w-full sm:w-2/3 lg:w-1/2 py-3.5 px-6 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-95 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => {
                  const tc = TIME_CONTROLS.find(c => c.id === selectedTimeControl);
                  if (!tc) return;

                  if (tc.preset !== null) {
                    setSelectedPreset(tc.preset);
                  }
                  modals.setOnlineModalInitialStep('board');
                  modals.setShowOnlineDialog(true);
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
      
      {modals.showLoadDialog && (
        <LoadGameModal
          savedGames={savedGames}
          boardLabels={boardLabels}
          onClose={() => modals.setShowLoadDialog(false)}
          onLoadGame={handleLoadGame}
        />
      )}

      {modals.showBoardDialog && (
        <BoardSelectionModal
          onClose={() => modals.setShowBoardDialog(false)}
          onSelectBoard={handleSelectBoard}
        />
      )}

      {modals.showOnlineDialog && (
        <OnlineChallengeModal
          onClose={() => modals.setShowOnlineDialog(false)}
          initialStep={modals.onlineModalInitialStep}
          initialPreset={selectedPreset}
          initialBoardSize={selectedBoardSize}
        />
      )}

      {modals.showAuthModal && <AuthModal onClose={() => modals.setShowAuthModal(false)} />}
      {modals.showProfileModal && <ProfileModal onClose={() => modals.setShowProfileModal(false)} />}
      {modals.showPlayersModal && <PlayersModal onClose={() => modals.setShowPlayersModal(false)} />}
      {modals.showChallengesModal && <ChallengesModal onClose={() => modals.setShowChallengesModal(false)} />}

      {modals.showRulesModal && <RulesModal onClose={() => modals.setShowRulesModal(false)} />}
    </div>
  );
}
