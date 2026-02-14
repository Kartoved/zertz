import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore, Language } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import AuthModal from '../Auth/AuthModal';
import ProfileModal from '../Auth/ProfileModal';
import PlayersModal from '../Auth/PlayersModal';
import ChallengesModal from '../Auth/ChallengesModal';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const APP_VERSION = '1.0.1';

const LANG_LABELS: Record<Language, string> = {
  ru: 'RU',
  en: 'EN',
  eo: 'EO',
};

const I18N: Record<Language, {
  subtitle: string;
  profile: string;
  loginRegister: string;
  playLocal: string;
  loadGame: string;
  rules: string;
  playOnline: string;
  players: string;
  challenges: string;
  tabCurrent: string;
  tabCompleted: string;
  filterAll: string;
  filterLocal: string;
  filterOnline: string;
  noGames: string;
  localLabel: string;
  onlineLabel: string;
  moves: string;
  board: string;
  inProgress: string;
  boardDialogTitle: string;
  board37: string;
  board48: string;
  board61: string;
  onlineTitleBoard: string;
  onlineTitlePlayer: string;
  onlineTitleLink: string;
  onlineBoardPrompt: string;
  playerPrompt: string;
  playerFirst: string;
  playerFirstHint: string;
  playerSecond: string;
  playerSecondHint: string;
  playerRandom: string;
  playerRandomHint: string;
  ratedGame: string;
  ratedHint: string;
  back: string;
  createGame: string;
  creating: string;
  createRoomError: string;
  gameCreatedHint: string;
  gameLink: string;
  copyLink: string;
  copied: string;
  goToGame: string;
  winTypeLabels: Record<string, string>;
}> = {
  ru: {
    subtitle: 'Абстрактная стратегическая игра',
    profile: 'Профиль',
    loginRegister: 'Войти / Зарегистрироваться',
    playLocal: 'Играть локально',
    loadGame: 'Загрузить игру',
    rules: 'Правила',
    playOnline: 'Сыграть онлайн',
    players: 'Игроки',
    challenges: 'Вызовы',
    tabCurrent: 'Текущие',
    tabCompleted: 'Завершённые',
    filterAll: 'Все',
    filterLocal: 'Локальные',
    filterOnline: 'Онлайн',
    noGames: 'Нет игр',
    localLabel: 'локальная',
    onlineLabel: 'онлайн',
    moves: 'Ходов',
    board: 'Поле',
    inProgress: 'В процессе',
    boardDialogTitle: 'Выберите поле',
    board37: 'Любительское 37 колец',
    board48: 'Турнирное 48 колец',
    board61: 'Турнирное 61 кольцо',
    onlineTitleBoard: 'Выберите размер поля',
    onlineTitlePlayer: 'Выберите игрока',
    onlineTitleLink: 'Ссылка для приглашения',
    onlineBoardPrompt: 'Выберите размер поля для онлайн-игры.',
    playerPrompt: 'Каким игроком вы хотите играть?',
    playerFirst: 'Первый игрок',
    playerFirstHint: 'Ходите первым',
    playerSecond: 'Второй игрок',
    playerSecondHint: 'Ходите вторым',
    playerRandom: 'Случайно',
    playerRandomHint: 'Случайный выбор',
    ratedGame: 'Рейтинговая игра',
    ratedHint: 'Влияет на рейтинг Глико',
    back: 'Назад',
    createGame: 'Создать игру',
    creating: 'Создание...',
    createRoomError: 'Не удалось создать комнату. Проверьте подключение к серверу.',
    gameCreatedHint: 'Игра создана! Отправьте ссылку другу для подключения.',
    gameLink: 'Ссылка на игру:',
    copyLink: 'Копировать ссылку',
    copied: '✓ Скопировано!',
    goToGame: 'Перейти к игре',
    winTypeLabels: { white: 'по белым', gray: 'по серым', black: 'по чёрным', mixed: 'по разным', unknown: 'победа' },
  },
  en: {
    subtitle: 'Abstract strategy game',
    profile: 'Profile',
    loginRegister: 'Login / Register',
    playLocal: 'Play Local',
    loadGame: 'Load Game',
    rules: 'Rules',
    playOnline: 'Play Online',
    players: 'Players',
    challenges: 'Challenges',
    tabCurrent: 'Current',
    tabCompleted: 'Completed',
    filterAll: 'All',
    filterLocal: 'Local',
    filterOnline: 'Online',
    noGames: 'No games',
    localLabel: 'local',
    onlineLabel: 'online',
    moves: 'Moves',
    board: 'Board',
    inProgress: 'In progress',
    boardDialogTitle: 'Choose board',
    board37: 'Amateur 37 rings',
    board48: 'Tournament 48 rings',
    board61: 'Tournament 61 rings',
    onlineTitleBoard: 'Choose board size',
    onlineTitlePlayer: 'Choose player',
    onlineTitleLink: 'Invite link',
    onlineBoardPrompt: 'Choose board size for online game.',
    playerPrompt: 'Which player do you want to play as?',
    playerFirst: 'First player',
    playerFirstHint: 'Move first',
    playerSecond: 'Second player',
    playerSecondHint: 'Move second',
    playerRandom: 'Random',
    playerRandomHint: 'Random choice',
    ratedGame: 'Rated game',
    ratedHint: 'Affects Glicko rating',
    back: 'Back',
    createGame: 'Create game',
    creating: 'Creating...',
    createRoomError: 'Failed to create room. Check server connection.',
    gameCreatedHint: 'Game created! Send the link to your friend.',
    gameLink: 'Game link:',
    copyLink: 'Copy link',
    copied: '✓ Copied!',
    goToGame: 'Go to game',
    winTypeLabels: { white: 'by white', gray: 'by gray', black: 'by black', mixed: 'by mixed', unknown: 'win' },
  },
  eo: {
    subtitle: 'Abstrakta strategia ludo',
    profile: 'Profilo',
    loginRegister: 'Ensaluti / Registriĝi',
    playLocal: 'Ludi loke',
    loadGame: 'Ŝargi ludon',
    rules: 'Reguloj',
    playOnline: 'Ludi rete',
    players: 'Ludantoj',
    challenges: 'Defioj',
    tabCurrent: 'Aktivaj',
    tabCompleted: 'Finitaj',
    filterAll: 'Ĉiuj',
    filterLocal: 'Lokaj',
    filterOnline: 'Retaj',
    noGames: 'Neniuj ludoj',
    localLabel: 'loka',
    onlineLabel: 'reta',
    moves: 'Movoj',
    board: 'Tabulo',
    inProgress: 'Daŭras',
    boardDialogTitle: 'Elektu tabulon',
    board37: 'Amatora 37 ringoj',
    board48: 'Turnira 48 ringoj',
    board61: 'Turnira 61 ringoj',
    onlineTitleBoard: 'Elektu grandecon de tabulo',
    onlineTitlePlayer: 'Elektu ludanton',
    onlineTitleLink: 'Invita ligilo',
    onlineBoardPrompt: 'Elektu tabulgrandecon por reta ludo.',
    playerPrompt: 'Kiel kiu ludanto vi volas ludi?',
    playerFirst: 'Unua ludanto',
    playerFirstHint: 'Movu unue',
    playerSecond: 'Dua ludanto',
    playerSecondHint: 'Movu due',
    playerRandom: 'Hazarde',
    playerRandomHint: 'Hazarda elekto',
    ratedGame: 'Taksata ludo',
    ratedHint: 'Influas Glicko-takson',
    back: 'Reen',
    createGame: 'Krei ludon',
    creating: 'Kreado...',
    createRoomError: 'Ne eblis krei ĉambron. Kontrolu servilan konekton.',
    gameCreatedHint: 'Ludo kreita! Sendu ligilon al amiko.',
    gameLink: 'Luda ligilo:',
    copyLink: 'Kopii ligilon',
    copied: '✓ Kopiite!',
    goToGame: 'Iri al ludo',
    winTypeLabels: { white: 'per blankaj', gray: 'per grizaj', black: 'per nigraj', mixed: 'per miksitaj', unknown: 'venko' },
  },
};

export default function MainMenu() {
  const navigate = useNavigate();
  const { setScreen, toggleDarkMode, isDarkMode, language, cycleLanguage } = useUIStore();
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
  const { user } = useAuthStore();
  const t = I18N[language];
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
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
          ZERTZ
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          {t.subtitle}
        </p>
      </div>
      
      <div className="flex flex-col gap-4 w-full max-w-xs">
        {user ? (
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full py-4 px-6 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold 
              rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            {t.profile} ({user.username})
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full py-4 px-6 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold 
              rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            {t.loginRegister}
          </button>
        )}

        <button
          onClick={handleNewGame}
          className="w-full py-4 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold 
            rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          {t.playLocal}
        </button>
        
        <button
          onClick={() => setShowLoadDialog(true)}
          className="w-full py-4 px-6 bg-green-500 hover:bg-green-600 text-white font-semibold 
            rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          {t.loadGame}
        </button>
        
        <button
          onClick={() => setScreen('rules')}
          className="w-full py-4 px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 
            dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold 
            rounded-xl shadow-md hover:shadow-lg transition-all transform hover:scale-105"
        >
          {t.rules}
        </button>

        <button
          onClick={() => setShowOnlineDialog(true)}
          className="w-full py-4 px-6 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl 
            shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          {t.playOnline}
        </button>

        <button
          onClick={() => setShowPlayersModal(true)}
          className="w-full py-4 px-6 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl 
            shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          {t.players}
        </button>

        {user && (
          <button
            onClick={() => setShowChallengesModal(true)}
            className="w-full py-4 px-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl 
              shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            {t.challenges}
          </button>
        )}
      </div>
      
      <div className="mt-12 flex items-center gap-3">
        <button
          onClick={cycleLanguage}
          className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-semibold text-gray-800 dark:text-white"
          title={`${t.rules}: ${LANG_LABELS[language]}`}
        >
          {LANG_LABELS[language]}
        </button>
        <button
          onClick={toggleDarkMode}
          className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 
            dark:hover:bg-gray-600 transition-colors"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>
      
      <div className="mt-8 text-sm text-gray-500 dark:text-gray-500">
        v{APP_VERSION}
      </div>
      
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
                  {t.tabCurrent} ({currentGames.length})
                </button>
                <button
                  onClick={() => setLoadTab('completed')}
                  className={`flex-1 py-2 px-4 text-center text-sm font-semibold transition-colors ${
                    loadTab === 'completed'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {t.tabCompleted} ({completedGames.length})
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
                                {t.winTypeLabels[game.winType] ?? game.winType}
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.boardDialogTitle}</h2>
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
                {onlineStep === 'board' && t.onlineTitleBoard}
                {onlineStep === 'player' && t.onlineTitlePlayer}
                {onlineStep === 'link' && t.onlineTitleLink}
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
