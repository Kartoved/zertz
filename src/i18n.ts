import { Language, useUIStore } from './store/uiStore';

export const LANGUAGE_LOCALE: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  eo: 'eo',
};

type Dict = {
  appSubtitle: string;
  versionFooter: string;
  developedBy: string;
  profile: string;
  loginRegister: string;
  playLocal: string;
  loadGame: string;
  rules: string;
  playOnline: string;
  players: string;
  challenges: string;
  tasks: string;
  community: string;
  loadCurrent: string;
  loadCompleted: string;
  filterAll: string;
  filterLocal: string;
  filterOnline: string;
  noGames: string;
  localLabel: string;
  onlineLabel: string;
  moves: string;
  board: string;
  inProgress: string;
  board37: string;
  board48: string;
  board61: string;
  chooseBoard: string;
  chooseBoardOnline: string;
  choosePlayer: string;
  inviteLinkTitle: string;
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
  login: string;
  register: string;
  nickname: string;
  yourNickname: string;
  password: string;
  passwordHint: string;
  confirmPassword: string;
  repeatPassword: string;
  fillAllFields: string;
  nicknameRangeError: string;
  passwordLengthError: string;
  passwordCharError: string;
  passwordsMismatch: string;
  loading: string;
  profileUpdated: string;
  profileTitle: string;
  registrationDate: string;
  rating: string;
  games: string;
  winsLosses: string;
  winrate: string;
  bestStreak: string;
  quote: string;
  quotePlaceholder: string;
  quoteNotSet: string;
  contact: string;
  contactPlaceholder: string;
  contactInvalid: string;
  country: string;
  chooseCountry: string;
  saveProfile: string;
  hidePasswordChange: string;
  showPasswordChange: string;
  currentPassword: string;
  newPassword: string;
  newPasswordPlaceholder: string;
  confirmNewPassword: string;
  showPasswords: string;
  changePassword: string;
  fillAllPasswordFields: string;
  newPasswordLengthError: string;
  newPasswordCharError: string;
  newPasswordsMismatch: string;
  passwordChanged: string;
  logout: string;
  allPlayers: string;
  friends: string;
  searchByNickname: string;
  noPlayers: string;
  noFriends: string;
  player: string;
  winsShort: string;
  lossesShort: string;
  regShort: string;
  unfollowed: string;
  followed: string;
  incoming: string;
  outgoing: string;
  noIncoming: string;
  noOutgoing: string;
  challengeDeclined: string;
  challengeCanceled: string;
  accepted: string;
  decline: string;
  cancel: string;
  boardLabel: string;
  rated: string;
  roomLoadingError: string;
  challengeSent: string;
  playerNotFound: string;
  close: string;
  registered: string;
  follow: string;
  unfollow: string;
  challengeToGame: string;
  challengeSettings: string;
  firstShort: string;
  secondShort: string;
  random: string;
  sendChallenge: string;
  sending: string;
  menu: string;
  undo: string;
  capturedMarbles: string;
  move: string;
  removeRing: string;
  mandatoryCapture: string;
  chooseMarble: string;
  noMovesYet: string;
  moveStart: string;
  deleteMovesConfirm: string;
  roomMenu: string;
  roomRules: string;
  copyRoomLink: string;
  you: string;
  yourTurn: string;
  opponentTurn: string;
  chooseMarbleShort: string;
  undoMove: string;
  expandChat: string;
  collapseChat: string;
  chat: string;
  noMessagesYet: string;
  messagePlaceholder: string;
  gameOver: string;
  gameRulesTitle: string;
  rematch: string;
  backToMenu: string;
  rematchChooseBoard: string;
  winByWhite: string;
  winByGray: string;
  winByBlack: string;
  winByMixed: string;
  winUnknown: string;
  phasePlacement: string;
  phaseRingRemoval: string;
  phaseCapture: string;
  goalTitle: string;
  goalLead: string;
  goal1: string;
  goal2: string;
  goal3: string;
  goal4: string;
  flowTitle: string;
  flowLead: string;
  flowPlacementTitle: string;
  flowPlace1: string;
  flowPlace2: string;
  flowPlace3: string;
  flowCaptureTitle: string;
  flowCaptureLead: string;
  flowCapture1: string;
  flowCapture2: string;
  flowCapture3: string;
  reserveTitle: string;
  reserveText1: string;
  reserveText2: string;
  reserveCounts: string;
  reserveSectionTitle: string;
  reserveSectionText1: string;
  reserveSectionText2: string;
  freeRingTitle: string;
  freeRingLead: string;
  freeRing1: string;
  freeRing2: string;
  isolationTitle: string;
  isolationText1: string;
  isolationText2: string;
  blitz: string;
  blitzDesc: string;
  rapid: string;
  rapidDesc: string;
  correspondence: string;
  correspondenceDesc: string;
  comingSoon: string;
  globalChat: string;
  guest: string;
  settings: string;
  playCorrespondence: string;
  selectTimeControl: string;
  darkMode: string;
  lightMode: string;
  openMenu: string;
  closeMenu: string;
  chatLoginToWrite: string;
  send: string;
  zertzByKrisBurm: string;
  tabPlay: string;
  tabBoard: string;
  tabControls: string;
  tabPlayers: string;
  surrender: string;
};

export const I18N: Record<Language, Dict> = {
  ru: {
    appSubtitle: 'Абстрактная стратегическая игра',
    versionFooter: 'v1.0.2',
    developedBy: 'Developed by Wood Romanov',
    profile: 'Профиль',
    loginRegister: 'Войти / Зарегистрироваться',
    playLocal: 'Играть локально',
    loadGame: 'Загрузить игру',
    rules: 'Правила',
    playOnline: 'Сыграть онлайн',
    players: 'Игроки',
    challenges: 'Вызовы',
    tasks: 'Задачи',
    community: 'Комьюнити',
    loadCurrent: 'Текущие',
    loadCompleted: 'Завершённые',
    filterAll: 'Все',
    filterLocal: 'Локальные',
    filterOnline: 'Онлайн',
    noGames: 'Нет игр',
    localLabel: 'локальная',
    onlineLabel: 'онлайн',
    moves: 'Ходов',
    board: 'Поле',
    inProgress: 'В процессе',
    board37: 'Любительское 37 колец',
    board48: 'Турнирное 48 колец',
    board61: 'Турнирное 61 кольцо',
    chooseBoard: 'Выберите поле',
    chooseBoardOnline: 'Выберите размер поля',
    choosePlayer: 'Выберите игрока',
    inviteLinkTitle: 'Ссылка для приглашения',
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
    login: 'Войти',
    register: 'Зарегистрироваться',
    nickname: 'Ник',
    yourNickname: 'Ваш ник',
    password: 'Пароль',
    passwordHint: 'Минимум 8 символов, включая спецсимвол',
    confirmPassword: 'Подтвердите пароль',
    repeatPassword: 'Повторите пароль',
    fillAllFields: 'Заполните все поля',
    nicknameRangeError: 'Ник должен быть от 2 до 24 символов',
    passwordLengthError: 'Пароль должен быть не менее 8 символов',
    passwordCharError: 'Пароль должен содержать хотя бы один спецсимвол (!@#$%^&*...)',
    passwordsMismatch: 'Пароли не совпадают',
    loading: 'Загрузка...',
    profileUpdated: 'Профиль обновлён',
    profileTitle: 'Профиль',
    registrationDate: 'Регистрация',
    rating: 'Рейтинг',
    games: 'Игр',
    winsLosses: 'Побед / Поражений',
    winrate: 'Винрейт',
    bestStreak: 'Лучшая серия побед',
    quote: 'Цитата',
    quotePlaceholder: 'Ваша цитата или девиз...',
    quoteNotSet: 'Цитата не задана',
    contact: 'Для связи',
    contactPlaceholder: 'https://t.me/username',
    contactInvalid: 'Поле "Для связи" должно содержать корректную ссылку (https://...)',
    country: 'Страна',
    chooseCountry: 'Выберите страну',
    saveProfile: 'Сохранить профиль',
    hidePasswordChange: '▾ Скрыть смену пароля',
    showPasswordChange: '▸ Сменить пароль',
    currentPassword: 'Текущий пароль',
    newPassword: 'Новый пароль',
    newPasswordPlaceholder: 'Новый пароль (мин. 8, со спецсимволом)',
    confirmNewPassword: 'Подтвердите новый пароль',
    showPasswords: 'Показать пароли',
    changePassword: 'Сменить пароль',
    fillAllPasswordFields: 'Заполните все поля пароля',
    newPasswordLengthError: 'Новый пароль должен быть не менее 8 символов',
    newPasswordCharError: 'Новый пароль должен содержать хотя бы один спецсимвол',
    newPasswordsMismatch: 'Новые пароли не совпадают',
    passwordChanged: 'Пароль изменён',
    logout: 'Выйти из аккаунта',
    allPlayers: 'Все игроки',
    friends: 'Друзья',
    searchByNickname: 'Поиск по нику...',
    noPlayers: 'Нет игроков',
    noFriends: 'Нет подписок',
    player: 'Игрок',
    winsShort: 'Побед',
    lossesShort: 'Пораж.',
    regShort: 'Рег.',
    unfollowed: 'Отписка оформлена',
    followed: 'Подписка оформлена',
    incoming: 'Входящие',
    outgoing: 'Исходящие',
    noIncoming: 'Нет входящих вызовов',
    noOutgoing: 'Нет исходящих вызовов',
    challengeDeclined: 'Вызов отклонён',
    challengeCanceled: 'Вызов отменён',
    accepted: 'Принять',
    decline: 'Отклонить',
    cancel: 'Отменить',
    boardLabel: 'Поле',
    rated: 'Рейтинговая',
    roomLoadingError: 'Ошибка загрузки профиля',
    challengeSent: 'Вызов отправлен!',
    playerNotFound: 'Игрок не найден',
    close: 'Закрыть',
    registered: 'Зарегистрирован',
    follow: 'Подписаться',
    unfollow: 'Отписаться',
    challengeToGame: 'Вызвать на игру',
    challengeSettings: 'Настройки вызова',
    firstShort: '1-й',
    secondShort: '2-й',
    random: 'Случайно',
    sendChallenge: 'Отправить вызов',
    sending: 'Отправка...',
    menu: 'Меню',
    undo: 'Отменить',
    capturedMarbles: 'Захваченные шарики:',
    move: 'Ход',
    removeRing: 'Удалите кольцо',
    mandatoryCapture: 'Обязательное взятие!',
    chooseMarble: 'Выберите шарик:',
    noMovesYet: 'Ходов пока нет',
    moveStart: 'старт',
    deleteMovesConfirm: 'Удалить ходы, начиная с этого?',
    roomMenu: 'Меню',
    roomRules: 'Правила',
    copyRoomLink: 'Скопировать ссылку',
    you: 'Вы',
    yourTurn: 'Ваш ход',
    opponentTurn: 'Ход соперника',
    chooseMarbleShort: 'Выбери шарик:',
    undoMove: 'Вернуть ход назад',
    expandChat: 'Развернуть чат',
    collapseChat: 'Свернуть чат',
    chat: 'Чат',
    noMessagesYet: 'Пока нет сообщений',
    messagePlaceholder: 'Сообщение...',
    gameOver: 'Партия завершена',
    gameRulesTitle: 'Правила игры ZERTZ',
    rematch: 'Реванш',
    backToMenu: 'В меню',
    rematchChooseBoard: 'Реванш: выберите поле',
    winByWhite: 'Победа по белым шарикам!',
    winByGray: 'Победа по серым шарикам!',
    winByBlack: 'Победа по чёрным шарикам!',
    winByMixed: 'Победа по разным шарикам!',
    winUnknown: 'Победа!',
    phasePlacement: 'Размести шарик',
    phaseRingRemoval: 'Удали кольцо',
    phaseCapture: 'Захвати шарик',
    goalTitle: 'Цель игры',
    goalLead: 'Первым захватить:',
    goal1: '4 белых шарика, ИЛИ',
    goal2: '5 серых шариков, ИЛИ',
    goal3: '6 чёрных шариков, ИЛИ',
    goal4: '3 шарика каждого цвета',
    flowTitle: 'Ход игры',
    flowLead: 'На каждом ходу игрок выполняет ОДНО из двух действий:',
    flowPlacementTitle: '1. Размещение + удаление кольца',
    flowPlace1: 'Выберите шарик любого цвета из резерва',
    flowPlace2: 'Поставьте его на любое пустое кольцо',
    flowPlace3: 'Удалите одно «свободное» кольцо с края доски, если это возможно',
    flowCaptureTitle: '2. Взятие (обязательно!)',
    flowCaptureLead: 'Если можете взять — ОБЯЗАНЫ взять!',
    flowCapture1: 'Прыгните через соседний шарик на пустое кольцо за ним',
    flowCapture2: 'Цвет не имеет значения',
    flowCapture3: 'Цепочки взятий - продолжайте захватывать шарики пока это возможно',
    reserveTitle: 'Запас шариков',
    reserveText1: 'В начале игры в',
    reserveText2: 'общем запасе',
    reserveCounts: '10 чёрных, 8 серых и 6 белых.',
    reserveSectionTitle: 'Резерв',
    reserveSectionText1: 'Резерв - это место, где хранятся шарики, которые еще не были использованы в игре.',
    reserveSectionText2: 'Игроки могут брать шарики из резерва и использовать их в своей игре.',
    freeRingTitle: 'Свободное кольцо',
    freeRingLead: 'Кольцо можно удалить если:',
    freeRing1: 'На нём нет шарика',
    freeRing2: 'У него ≥2 свободных соседних стороны',
    isolationTitle: 'Изоляция',
    isolationText1: 'Если группа колец отделяется от основной доски и все кольца заняты —',
    isolationText2: 'все шарики в группе автоматически захватываются текущим игроком!',
    blitz: 'Блиц',
    blitzDesc: 'Быстрая игра, ограниченное время',
    rapid: 'Рапид',
    rapidDesc: 'Умеренный контроль времени',
    correspondence: 'Заочная',
    correspondenceDesc: 'Без ограничения по времени',
    comingSoon: 'Скоро',
    globalChat: 'Общий чат',
    guest: 'Гость',
    settings: 'Настройки',
    playCorrespondence: 'Играть заочно',
    selectTimeControl: 'Выберите контроль времени',
    darkMode: 'Тёмная тема',
    lightMode: 'Светлая тема',
    openMenu: 'Открыть меню',
    closeMenu: 'Закрыть меню',
    chatLoginToWrite: 'Войдите, чтобы писать в чат',
    send: 'Отправить',
    zertzByKrisBurm: 'Zertz by Kris Burm',
    tabPlay: 'Игра',
    tabBoard: 'Доска',
    tabControls: 'Панель',
    tabPlayers: 'Игроки',
    surrender: 'Сдаться',
  },
  en: {
    appSubtitle: 'Abstract strategy game',
    versionFooter: 'v1.0.2',
    developedBy: 'Developed by Wood Romanov',
    profile: 'Profile',
    loginRegister: 'Login / Register',
    playLocal: 'Play Local',
    loadGame: 'Load Game',
    rules: 'Rules',
    playOnline: 'Play Online',
    players: 'Players',
    challenges: 'Challenges',
    tasks: 'Tasks',
    community: 'Community',
    loadCurrent: 'Current',
    loadCompleted: 'Completed',
    filterAll: 'All',
    filterLocal: 'Local',
    filterOnline: 'Online',
    noGames: 'No games',
    localLabel: 'local',
    onlineLabel: 'online',
    moves: 'Moves',
    board: 'Board',
    inProgress: 'In progress',
    board37: 'Amateur 37 rings',
    board48: 'Tournament 48 rings',
    board61: 'Tournament 61 rings',
    chooseBoard: 'Choose board',
    chooseBoardOnline: 'Choose board size',
    choosePlayer: 'Choose player',
    inviteLinkTitle: 'Invite link',
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
    login: 'Login',
    register: 'Register',
    nickname: 'Nickname',
    yourNickname: 'Your nickname',
    password: 'Password',
    passwordHint: 'Minimum 8 symbols with a special character',
    confirmPassword: 'Confirm password',
    repeatPassword: 'Repeat password',
    fillAllFields: 'Fill all fields',
    nicknameRangeError: 'Nickname must be 2 to 24 characters',
    passwordLengthError: 'Password must be at least 8 characters',
    passwordCharError: 'Password must contain at least one special symbol (!@#$%^&*...)',
    passwordsMismatch: 'Passwords do not match',
    loading: 'Loading...',
    profileUpdated: 'Profile updated',
    profileTitle: 'Profile',
    registrationDate: 'Registration',
    rating: 'Rating',
    games: 'Games',
    winsLosses: 'Wins / Losses',
    winrate: 'Winrate',
    bestStreak: 'Best win streak',
    quote: 'Quote',
    quotePlaceholder: 'Your quote or motto...',
    quoteNotSet: 'Quote is not set',
    contact: 'Contact',
    contactPlaceholder: 'https://t.me/username',
    contactInvalid: 'Contact field must contain a valid URL (https://...)',
    country: 'Country',
    chooseCountry: 'Choose country',
    saveProfile: 'Save profile',
    hidePasswordChange: '▾ Hide password change',
    showPasswordChange: '▸ Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    newPasswordPlaceholder: 'New password (min. 8, with special symbol)',
    confirmNewPassword: 'Confirm new password',
    showPasswords: 'Show passwords',
    changePassword: 'Change password',
    fillAllPasswordFields: 'Fill all password fields',
    newPasswordLengthError: 'New password must be at least 8 characters',
    newPasswordCharError: 'New password must contain at least one special symbol',
    newPasswordsMismatch: 'New passwords do not match',
    passwordChanged: 'Password changed',
    logout: 'Log out',
    allPlayers: 'All players',
    friends: 'Friends',
    searchByNickname: 'Search by nickname...',
    noPlayers: 'No players',
    noFriends: 'No subscriptions',
    player: 'Player',
    winsShort: 'Wins',
    lossesShort: 'Losses',
    regShort: 'Reg.',
    unfollowed: 'Unfollowed',
    followed: 'Followed',
    incoming: 'Incoming',
    outgoing: 'Outgoing',
    noIncoming: 'No incoming challenges',
    noOutgoing: 'No outgoing challenges',
    challengeDeclined: 'Challenge declined',
    challengeCanceled: 'Challenge canceled',
    accepted: 'Accept',
    decline: 'Decline',
    cancel: 'Cancel',
    boardLabel: 'Board',
    rated: 'Rated',
    roomLoadingError: 'Failed to load profile',
    challengeSent: 'Challenge sent!',
    playerNotFound: 'Player not found',
    close: 'Close',
    registered: 'Registered',
    follow: 'Follow',
    unfollow: 'Unfollow',
    challengeToGame: 'Challenge to game',
    challengeSettings: 'Challenge settings',
    firstShort: '1st',
    secondShort: '2nd',
    random: 'Random',
    sendChallenge: 'Send challenge',
    sending: 'Sending...',
    menu: 'Menu',
    undo: 'Undo',
    capturedMarbles: 'Captured marbles:',
    move: 'Move',
    removeRing: 'Remove a ring',
    mandatoryCapture: 'Capture is mandatory!',
    chooseMarble: 'Choose a marble:',
    noMovesYet: 'No moves yet',
    moveStart: 'start',
    deleteMovesConfirm: 'Delete moves starting from this one?',
    roomMenu: 'Menu',
    roomRules: 'Rules',
    copyRoomLink: 'Copy link',
    you: 'You',
    yourTurn: 'Your turn',
    opponentTurn: "Opponent's turn",
    chooseMarbleShort: 'Choose marble:',
    undoMove: 'Undo move',
    expandChat: 'Expand chat',
    collapseChat: 'Collapse chat',
    chat: 'Chat',
    noMessagesYet: 'No messages yet',
    messagePlaceholder: 'Message...',
    gameOver: 'Game finished',
    gameRulesTitle: 'ZERTZ Game Rules',
    rematch: 'Rematch',
    backToMenu: 'To menu',
    rematchChooseBoard: 'Rematch: choose board',
    winByWhite: 'Win by white marbles!',
    winByGray: 'Win by gray marbles!',
    winByBlack: 'Win by black marbles!',
    winByMixed: 'Win by mixed marbles!',
    winUnknown: 'Win!',
    phasePlacement: 'Place a marble',
    phaseRingRemoval: 'Remove a ring',
    phaseCapture: 'Capture a marble',
    goalTitle: 'Goal',
    goalLead: 'Be first to capture:',
    goal1: '4 white marbles, OR',
    goal2: '5 gray marbles, OR',
    goal3: '6 black marbles, OR',
    goal4: '3 marbles of each color',
    flowTitle: 'Gameplay',
    flowLead: 'On each turn a player performs ONE of two actions:',
    flowPlacementTitle: '1. Placement + ring removal',
    flowPlace1: 'Choose a marble of any color from reserve',
    flowPlace2: 'Place it on any empty ring',
    flowPlace3: 'Remove one free edge ring if possible',
    flowCaptureTitle: '2. Capture (mandatory!)',
    flowCaptureLead: 'If you can capture — you must capture!',
    flowCapture1: 'Jump over an adjacent marble to an empty ring behind it',
    flowCapture2: 'Color does not matter',
    flowCapture3: 'Capture chains: continue capturing while possible',
    reserveTitle: 'Marble stock',
    reserveText1: 'At the start of the game the',
    reserveText2: 'common stock',
    reserveCounts: '10 black, 8 gray and 6 white marbles.',
    reserveSectionTitle: 'Reserve',
    reserveSectionText1: 'Reserve is where marbles not yet used in the game are stored.',
    reserveSectionText2: 'Players can take marbles from reserve and use them in game.',
    freeRingTitle: 'Free ring',
    freeRingLead: 'A ring can be removed if:',
    freeRing1: 'It has no marble',
    freeRing2: 'It has at least 2 free adjacent sides',
    isolationTitle: 'Isolation',
    isolationText1: 'If a ring group separates from the main board and all rings are occupied —',
    isolationText2: 'all marbles in that group are captured by the current player!',
    blitz: 'Blitz',
    blitzDesc: 'Fast game, limited time',
    rapid: 'Rapid',
    rapidDesc: 'Moderate time control',
    correspondence: 'Correspondence',
    correspondenceDesc: 'No time limit',
    comingSoon: 'Coming soon',
    globalChat: 'Global Chat',
    guest: 'Guest',
    settings: 'Settings',
    playCorrespondence: 'Play correspondence',
    selectTimeControl: 'Select time control',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    chatLoginToWrite: 'Log in to write in chat',
    send: 'Send',
    zertzByKrisBurm: 'Zertz by Kris Burm',
    tabPlay: 'Play',
    tabBoard: 'Board',
    tabControls: 'Controls',
    tabPlayers: 'Players',
    surrender: 'Resign',
  },
  eo: {
    appSubtitle: 'Abstrakta strategia ludo',
    versionFooter: 'v1.0.2',
    developedBy: 'Developed by Wood Romanov',
    profile: 'Profilo',
    loginRegister: 'Ensaluti / Registriĝi',
    playLocal: 'Ludi loke',
    loadGame: 'Ŝargi ludon',
    rules: 'Reguloj',
    playOnline: 'Ludi rete',
    players: 'Ludantoj',
    challenges: 'Defioj',
    tasks: 'Taskoj',
    community: 'Komunumo',
    loadCurrent: 'Aktivaj',
    loadCompleted: 'Finitaj',
    filterAll: 'Ĉiuj',
    filterLocal: 'Lokaj',
    filterOnline: 'Retaj',
    noGames: 'Neniuj ludoj',
    localLabel: 'loka',
    onlineLabel: 'reta',
    moves: 'Movoj',
    board: 'Tabulo',
    inProgress: 'Daŭras',
    board37: 'Amatora 37 ringoj',
    board48: 'Turnira 48 ringoj',
    board61: 'Turnira 61 ringoj',
    chooseBoard: 'Elektu tabulon',
    chooseBoardOnline: 'Elektu tabulgrandecon',
    choosePlayer: 'Elektu ludanton',
    inviteLinkTitle: 'Invita ligilo',
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
    login: 'Ensaluti',
    register: 'Registriĝi',
    nickname: 'Nomo',
    yourNickname: 'Via nomo',
    password: 'Pasvorto',
    passwordHint: 'Minimume 8 signoj kun speciala signo',
    confirmPassword: 'Konfirmu pasvorton',
    repeatPassword: 'Ripetu pasvorton',
    fillAllFields: 'Plenigu ĉiujn kampojn',
    nicknameRangeError: 'Nomo devas havi 2 ĝis 24 signojn',
    passwordLengthError: 'Pasvorto devas havi almenaŭ 8 signojn',
    passwordCharError: 'Pasvorto devas enhavi almenaŭ unu specialan signon',
    passwordsMismatch: 'Pasvortoj ne kongruas',
    loading: 'Ŝargado...',
    profileUpdated: 'Profilo ĝisdatigita',
    profileTitle: 'Profilo',
    registrationDate: 'Registriĝo',
    rating: 'Taksado',
    games: 'Ludoj',
    winsLosses: 'Venkoj / Malvenkoj',
    winrate: 'Venkofteco',
    bestStreak: 'Plej bona serio',
    quote: 'Citaĵo',
    quotePlaceholder: 'Via citaĵo aŭ devizo...',
    quoteNotSet: 'Citaĵo ne estas agordita',
    contact: 'Kontakto',
    contactPlaceholder: 'https://t.me/username',
    contactInvalid: 'Kampo "Kontakto" devas enhavi validan URL-on (https://...)',
    country: 'Lando',
    chooseCountry: 'Elektu landon',
    saveProfile: 'Konservi profilon',
    hidePasswordChange: '▾ Kaŝi pasvortan ŝanĝon',
    showPasswordChange: '▸ Ŝanĝi pasvorton',
    currentPassword: 'Nuna pasvorto',
    newPassword: 'Nova pasvorto',
    newPasswordPlaceholder: 'Nova pasvorto (min. 8, kun speciala signo)',
    confirmNewPassword: 'Konfirmu novan pasvorton',
    showPasswords: 'Montri pasvortojn',
    changePassword: 'Ŝanĝi pasvorton',
    fillAllPasswordFields: 'Plenigu ĉiujn pasvortajn kampojn',
    newPasswordLengthError: 'Nova pasvorto devas havi almenaŭ 8 signojn',
    newPasswordCharError: 'Nova pasvorto devas enhavi almenaŭ unu specialan signon',
    newPasswordsMismatch: 'Novaj pasvortoj ne kongruas',
    passwordChanged: 'Pasvorto ŝanĝita',
    logout: 'Elsaluti',
    allPlayers: 'Ĉiuj ludantoj',
    friends: 'Amikoj',
    searchByNickname: 'Serĉi laŭ nomo...',
    noPlayers: 'Neniuj ludantoj',
    noFriends: 'Neniuj abonoj',
    player: 'Ludanto',
    winsShort: 'Venk.',
    lossesShort: 'Malv.',
    regShort: 'Reg.',
    unfollowed: 'Malabono farita',
    followed: 'Abono farita',
    incoming: 'Envenaj',
    outgoing: 'Elvenaj',
    noIncoming: 'Neniuj envenaj defioj',
    noOutgoing: 'Neniuj elvenaj defioj',
    challengeDeclined: 'Defio malakceptita',
    challengeCanceled: 'Defio nuligita',
    accepted: 'Akcepti',
    decline: 'Malakcepti',
    cancel: 'Nuligi',
    boardLabel: 'Tabulo',
    rated: 'Taksata',
    roomLoadingError: 'Malsukcesis ŝargi profilon',
    challengeSent: 'Defio sendita!',
    playerNotFound: 'Ludanto ne trovita',
    close: 'Fermi',
    registered: 'Registrita',
    follow: 'Aboni',
    unfollow: 'Malaboni',
    challengeToGame: 'Defii al ludo',
    challengeSettings: 'Agordoj de defio',
    firstShort: '1a',
    secondShort: '2a',
    random: 'Hazarde',
    sendChallenge: 'Sendi defion',
    sending: 'Sendado...',
    menu: 'Menuo',
    undo: 'Malfari',
    capturedMarbles: 'Kaptitaj globetoj:',
    move: 'Movo',
    removeRing: 'Forigu ringon',
    mandatoryCapture: 'Kaptado estas deviga!',
    chooseMarble: 'Elektu globeton:',
    noMovesYet: 'Ankoraŭ neniuj movoj',
    moveStart: 'komenco',
    deleteMovesConfirm: 'Ĉu forigi movojn ekde ĉi tiu?',
    roomMenu: 'Menuo',
    roomRules: 'Reguloj',
    copyRoomLink: 'Kopii ligilon',
    you: 'Vi',
    yourTurn: 'Via vico',
    opponentTurn: 'Vico de kontraŭulo',
    chooseMarbleShort: 'Elektu globeton:',
    undoMove: 'Malfari movon',
    expandChat: 'Malfaldi babilejon',
    collapseChat: 'Faldi babilejon',
    chat: 'Babilejo',
    noMessagesYet: 'Ankoraŭ neniuj mesaĝoj',
    messagePlaceholder: 'Mesaĝo...',
    gameOver: 'Partio finiĝis',
    gameRulesTitle: 'Reguloj de ZERTZ',
    rematch: 'Revanĉo',
    backToMenu: 'Al menuo',
    rematchChooseBoard: 'Revanĉo: elektu tabulon',
    winByWhite: 'Venko per blankaj globetoj!',
    winByGray: 'Venko per grizaj globetoj!',
    winByBlack: 'Venko per nigraj globetoj!',
    winByMixed: 'Venko per miksitaj globetoj!',
    winUnknown: 'Venko!',
    phasePlacement: 'Metu globeton',
    phaseRingRemoval: 'Forigu ringon',
    phaseCapture: 'Kaptu globeton',
    goalTitle: 'Celo',
    goalLead: 'Unue kaptu:',
    goal1: '4 blankajn globetojn, AŬ',
    goal2: '5 grizajn globetojn, AŬ',
    goal3: '6 nigrajn globetojn, AŬ',
    goal4: '3 globetojn de ĉiu koloro',
    flowTitle: 'Ludfluo',
    flowLead: 'Ĉe ĉiu vico ludanto faras UNU el du agoj:',
    flowPlacementTitle: '1. Meto + forigo de ringo',
    flowPlace1: 'Elektu globeton de ajna koloro el rezervo',
    flowPlace2: 'Metu ĝin sur ajnan malplenan ringon',
    flowPlace3: 'Forigu unu liberan randan ringon, se eblas',
    flowCaptureTitle: '2. Kaptado (deviga!)',
    flowCaptureLead: 'Se vi povas kapti — vi devas kapti!',
    flowCapture1: 'Saltu super apudan globeton al malplena ringo malantaŭ ĝi',
    flowCapture2: 'Koloro ne gravas',
    flowCapture3: 'Kaptĉenoj: daŭrigu kapti dum eblas',
    reserveTitle: 'Stoko de globetoj',
    reserveText1: 'Komence de ludo la',
    reserveText2: 'komuna stoko',
    reserveCounts: '10 nigraj, 8 grizaj kaj 6 blankaj globetoj.',
    reserveSectionTitle: 'Rezervo',
    reserveSectionText1: 'Rezervo estas loko kie konserviĝas globetoj ankoraŭ ne uzitaj en la ludo.',
    reserveSectionText2: 'Ludantoj povas preni globetojn el rezervo kaj uzi ilin en la ludo.',
    freeRingTitle: 'Libera ringo',
    freeRingLead: 'Ringo povas esti forigita se:',
    freeRing1: 'Sur ĝi ne estas globeto',
    freeRing2: 'Ĝi havas almenaŭ 2 liberajn apudajn flankojn',
    isolationTitle: 'Izoliĝo',
    isolationText1: 'Se grupo de ringoj apartiĝas de la ĉefa tabulo kaj ĉiuj ringoj estas okupitaj —',
    isolationText2: 'ĉiuj globetoj en tiu grupo estas kaptitaj de la nuna ludanto!',
    blitz: 'Blico',
    blitzDesc: 'Rapida ludo, limigita tempo',
    rapid: 'Rapida',
    rapidDesc: 'Modera tempkontrolo',
    correspondence: 'Koresponda',
    correspondenceDesc: 'Sen templimo',
    comingSoon: 'Baldaŭ',
    globalChat: 'Ĝenerala babilejo',
    guest: 'Gasto',
    settings: 'Agordoj',
    playCorrespondence: 'Ludi koresponde',
    selectTimeControl: 'Elektu tempkontrolon',
    darkMode: 'Malhela temo',
    lightMode: 'Hela temo',
    openMenu: 'Malfermi menuon',
    closeMenu: 'Fermi menuon',
    chatLoginToWrite: 'Ensalutu por skribi en babilejo',
    send: 'Sendi',
    zertzByKrisBurm: 'Zertz by Kris Burm',
    tabPlay: 'Ludo',
    tabBoard: 'Tabulo',
    tabControls: 'Panelo',
    tabPlayers: 'Ludantoj',
    surrender: 'Rezigni',
  },
};

export function useI18n() {
  const language = useUIStore((s) => s.language);
  return {
    language,
    t: I18N[language],
    locale: LANGUAGE_LOCALE[language],
  };
}

export function getI18nFromStorage() {
  const saved = localStorage.getItem('zertz_language');
  const language: Language = saved === 'ru' || saved === 'eo' || saved === 'en' ? saved : 'en';
  return {
    language,
    t: I18N[language],
    locale: LANGUAGE_LOCALE[language],
  };
}

export function getWinTypeLabel(t: Dict, winType: string | null | undefined): string {
  if (winType === 'white') return t.winByWhite;
  if (winType === 'gray') return t.winByGray;
  if (winType === 'black') return t.winByBlack;
  if (winType === 'mixed') return t.winByMixed;
  return t.winUnknown;
}
