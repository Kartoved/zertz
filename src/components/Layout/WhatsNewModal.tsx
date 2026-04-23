import { useI18n } from '../../i18n';
import { APP_VERSION } from '../../version';

const SEEN_VERSION_KEY = 'zertz_whats_new_seen';

export function getUnseenVersion(): boolean {
  return localStorage.getItem(SEEN_VERSION_KEY) !== APP_VERSION;
}

export function markVersionSeen(): void {
  localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION);
}

interface WhatsNewModalProps {
  onClose: () => void;
}

interface ChangelogEntry {
  version: string;
  date: string;
  changes: { ru: string[]; en: string[]; eo: string[] };
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.9.26',
    date: '2026-04-24',
    changes: {
      ru: [
        'Комнаты — главная вкладка: создай партию (через тот же диалог, что и «По ссылке») и жди соперника в списке',
        'Ладдер — вторая вкладка: поиск по матчмейкингу, выбор доски и времени',
        'Кнопка копирования ссылки прямо в карточке ожидающей комнаты (иконкой)',
        'Текущие онлайн-партии отображаются в табе «Комнаты»',
        'Счётчик ожидающих комнат на вкладке обновляется в реальном времени',
        'Версия обновлена до v0.9.26',
      ],
      en: [
        'Rooms — default tab: create a game (same dialog as "Play by Link") and wait for an opponent in the list',
        'Ladder — second tab: matchmaking search, board and time control selection',
        'Copy-link icon button directly on each waiting room card',
        'Current online games shown in the Rooms tab',
        'Waiting rooms counter on the tab updates in real time',
        'Version updated to v0.9.26',
      ],
      eo: [
        'Ĉambroj — ĉefa langeto: kreu ludon (sama dialogo kiel "Ludi per ligilo") kaj atendu kontraŭulon en la listo',
        'Skaloj — dua langeto: serĉo per kontraŭulomatĉado, elekto de tabulo kaj tempa kontrolo',
        'Kopiada ligila ikono-butono rekte sur la atendanta ĉambra karto',
        'Aktualaj retaj ludoj montrataj en la langeto Ĉambroj',
        'Kalkulilo de atendantaj ĉambroj sur la langeto ĝisdatiĝas en reala tempo',
        'Versio ĝisdatigita al v0.9.26',
      ],
    },
  },
  {
    version: '0.9.25',
    date: '2026-04-20',
    changes: {
      ru: [
        'Лобби — новая вкладка: создай открытую партию и жди любого соперника; список обновляется каждые 5 секунд',
        'Создатель автоматически попадает в комнату, когда соперник принимает вызов из лобби',
        'Ссылки на сообщества в меню «Комьюнити»: Клуб Итерация (Telegram), ВКонтакте, Дискорд',
        'Кнопка «Игра против бота» временно скрыта — появится в следующих версиях',
        'Что нового открывается автоматически при первом запуске после обновления',
        'Версия обновлена до v0.9.25',
      ],
      en: [
        'Lobby — new tab: create an open game and wait for any opponent; list refreshes every 5 seconds',
        'Creator is automatically redirected to the room when an opponent accepts from the lobby',
        'Community links in the menu: Iteracia Club (Telegram), VKontakte, Discord',
        '"Play vs Bot" button temporarily hidden — coming in a future release',
        'What\'s New opens automatically on first launch after an update',
        'Version updated to v0.9.25',
      ],
      eo: [
        'Lobiejo — nova langeto: kreu malfermaitan ludon kaj atendu iun ajn kontraŭulon; listo ĝisdatiĝas ĉiujn 5 sekundojn',
        'Kreinto aŭtomate transiras al la ĉambro kiam kontraŭulo akceptas el la lobiejo',
        'Komunumaj ligiloj en la menuo: Klubo Iteracia (Telegram), VKontakte, Diskord',
        'Butono "Ludi kontraŭ roboto" provizore kaŝita — aperos en estontaj eldonoj',
        'Kio estas nova malfermiĝas aŭtomate ĉe la unua lanĉo post ĝisdatigo',
        'Versio ĝisdatigita al v0.9.25',
      ],
    },
  },
  {
    version: '0.9.24',
    date: '2026-03-29',
    changes: {
      ru: [
        'Magic Link: вход по ссылке на email — без пароля, оба способа входа доступны одновременно',
        'Email в профиле — привяжите почту для входа через Magic Link',
        'Диалог «Сыграть / Наблюдать» при переходе по ссылке комнаты — теперь зрители не захватывают место случайно',
        'Кликабельные никнеймы в глобальном чате — открывают профиль игрока',
        'Иконка вызова становится красной с бейджем при входящих вызовах',
        'Пуш-уведомления включены по умолчанию для новых пользователей',
        'Нотация: захваты при изоляции теперь отображаются как суффикс +цвета (напр. Gb3 -c4 +w)',
        'Исправлен скролл глобального чата при переходах между экранами',
        'Исправлено: зрители не видят кнопки принять/отклонить анд',
        'Юнит-тесты игрового движка: 54 теста покрывают всю логику',
        'Версия обновлена до v0.9.24',
      ],
      en: [
        'Magic Link: sign in via email link — no password needed, both login methods available simultaneously',
        'Email in profile — add your email to enable Magic Link login',
        'Join dialog when opening a room link — choose to play or watch, no more accidental seat claims',
        'Clickable nicknames in global chat — opens the player\'s profile',
        'Challenge icon turns red with a badge on incoming challenges',
        'Push notifications enabled by default for new users',
        'Notation: isolation captures now appear as a suffix +colors (e.g. Gb3 -c4 +w)',
        'Fixed global chat scroll jumping when navigating between screens',
        'Fixed: spectators no longer see undo accept/reject buttons',
        'Game engine unit tests: 54 tests covering all game logic',
        'Version updated to v0.9.24',
      ],
      eo: [
        'Magic Link: ensalutu per retpoŝta ligilo — sen pasvorto, ambaŭ ensalutmetodoj disponeblaj samtempe',
        'Retpoŝto en profilo — aldonu vian retpoŝton por ebligi ensaluton per Magic Link',
        'Dialogo "Ludi / Spekti" dum malferma ĉambra ligilo — elektu rolon, ne plu akcidenta sidlokkaptado',
        'Alklakeblaj kaŝnomoj en tutmonda babilejo — malfermas profilon de ludanto',
        'Defia ikono ruĝiĝas kun insigno ĉe envenantaj defioj',
        'Puŝ-sciigoj ŝaltitaj defaŭlte por novaj uzantoj',
        'Notacio: izolitaj kapturoj nun aperas kiel sufikso +koloroj (ekz. Gb3 -c4 +w)',
        'Korektita rulumado de tutmonda babilejo dum navigado inter ekranoj',
        'Korektita: spektantoj ne plu vidas butonojn akcepti/rifuzi malfaro-peton',
        'Unuotestoj de ludmotoro: 54 testoj kovras ĉiun ludan logikon',
        'Versio ĝisdatigita al v0.9.24',
      ],
    },
  },
  {
    version: '0.9.23',
    date: '2026-03-28',
    changes: {
      ru: [
        'Исправлена нотация: нумерация колец теперь от нижнего кольца каждой вертикали',
        'Нотация захватов: цвет шара, стартовая позиция, цепочка через ×, суффикс взятых шаров (+wgb)',
        'Исправлен баг: кнопка "Аннулировать" больше не появляется при просмотре старых ходов в дереве',
        'Исправлен баг: номер хода в чате показывался неправильно (+1 лишний)',
        'Фиксированная высота чата — больше не растягивает страницу',
        'Версия обновлена до v0.9.23',
      ],
      en: [
        'Fixed notation: ring numbers now count from the bottom of each column',
        'Capture notation: marble color, start position, chain with ×, captured marbles suffix (+wgb)',
        'Fixed: "Cancel game" button no longer appears when viewing old moves in the tree',
        'Fixed: move number in chat was shown incorrectly (off by one)',
        'Chat panel now has fixed height — no longer stretches the page',
        'Version updated to v0.9.23',
      ],
      eo: [
        'Korektita notacio: ringaj nombroj nun kalkuliĝas de la malsupra ringo de ĉiu kolumno',
        'Kaptura notacio: koloro de marmoro, startpozicio, ĉeno per ×, sufikso de kaptitaj marmoroj (+wgb)',
        'Korektita: butono "Nuligi ludon" ne plu aperas dum rigardo de malnovaj movoj en la arbo',
        'Korektita: movo-numero en babilejo montriĝis malĝuste (+1 ekstra)',
        'Babiljfenestro havas nun fiksan alton — ne plu etendiĝas la paĝon',
        'Versio ĝisdatigita al v0.9.23',
      ],
    },
  },
  {
    version: '0.9.22',
    date: '2026-03-28',
    changes: {
      ru: [
        'Пуш-уведомления: получайте уведомления о ходе соперника и вызовах (включить в настройках)',
        'Исправлено: модал отменённой партии больше не показывает "победитель"',
        'Временной контроль при вызове игрока через его профиль',
        'Мобильный UX: временные режимы в сетке 2×2, удобнее на маленьких экранах',
        'Мобильный UX: история ходов отображается под доской',
        'Мобильный UX: карточки игроков рядом (горизонтально)',
        'Мобильный UX: кнопки "Поиск игры" и "Сыграть по ссылке" на одной строке',
        'Переименование "Заочная" → "Асинхронная" везде в интерфейсе',
        'Новый порядок кнопок в шапке: гамбургер → игроки → вызовы → настройки → профиль',
        'Версия обновлена до v0.9.22',
      ],
      en: [
        'Push notifications: get notified when it\'s your turn or you receive a challenge (enable in settings)',
        'Fixed: cancelled game modal no longer shows a winner',
        'Time control selector when challenging a player via their profile card',
        'Mobile UX: time control presets in a 2×2 grid for smaller screens',
        'Mobile UX: move history shown below the board',
        'Mobile UX: player cards displayed side-by-side',
        'Mobile UX: "Search game" and "Play by link" buttons on one row',
        'Renamed "Correspondence" to "Async" across the UI',
        'Reordered header buttons: hamburger → players → challenges → settings → profile',
        'Version updated to v0.9.22',
      ],
      eo: [
        'Puŝ-sciigoj: ricevu sciigon kiam estas via vico aŭ vi ricevas defion (ŝaltu en agordoj)',
        'Korektita: modalo de nuligita ludo ne plu montras venkanton',
        'Elektilo de tempa kontrolo dum defiado de ludanto per lia profila karto',
        'Portebla UX: tempaj antaŭagordaĵoj en krado 2×2 por malgrandaj ekranoj',
        'Portebla UX: movhistorio montrata sub la tabulo',
        'Portebla UX: ludant-kartoj flanke unu de la alia',
        'Portebla UX: butonoj "Serĉi ludon" kaj "Ludi per ligilo" sur unu linio',
        'Renomita "Koresponda" al "Asinkrona" en la interfaco',
        'Reordigitaj kapliniaj butonoj: hamburgero → ludantoj → defioj → agordoj → profilo',
        'Versio ĝisdatigita al v0.9.22',
      ],
    },
  },
  {
    version: '0.9.21',
    date: '2026-03-24',
    changes: {
      ru: [
        'PWA: приложение можно установить на телефон или компьютер',
        'Новая иконка приложения',
        'Версия обновлена до v0.9.21',
      ],
      en: [
        'PWA: the app can now be installed on phone or desktop',
        'New app icon',
        'Version updated to v0.9.21',
      ],
      eo: [
        'PWA: la aplikaĵo nun instaleblas sur telefono aŭ komputilo',
        'Nova aplikaĵa ikono',
        'Versio ĝisdatigita al v0.9.21',
      ],
    },
  },
  {
    version: '0.9.20',
    date: '2026-03-24',
    changes: {
      ru: [
        'Аннулирование партии до 3-го хода — без изменения рейтинга',
        'Режим зрителя: переход по ссылке партии без авторизации',
        'Зрители не могут писать в чат игроков',
        'Вкладка "Архив всех партий" в просмотре партий',
        'Кнопка "Партии" в профиле игрока — показывает его партии',
        'Аннулированные партии отображаются корректно в истории',
        'Версия обновлена до v0.9.20',
      ],
      en: [
        'Game cancellation before move 3 — no rating change',
        'Spectator mode: join any game by link without auth',
        'Spectators cannot write in the players\' chat',
        '"Game Archive" tab added to the games viewer',
        '"Games" button in player profile — shows their games',
        'Cancelled games displayed correctly in history',
        'Version updated to v0.9.20',
      ],
      eo: [
        'Nuligado de ludo antaŭ la 3a movo — sen ŝanĝo de rangotabelo',
        'Spektanta reĝimo: aliĝu al iu ajn ludo per ligilo sen aŭtentikigo',
        'Spektantoj ne povas skribi en la babilejo de ludantoj',
        'Aldonis langeton "Arkivo de ĉiuj ludoj" en la ludvidilon',
        'Butono "Ludoj" en profilo de ludanto — montras liajn ludojn',
        'Nuligitaj ludoj estas montritaj ĝuste en historio',
        'Versio ĝisdatigita al v0.9.20',
      ],
    },
  },
  {
    version: '0.9.1',
    date: '2026-03-24',
    changes: {
      ru: [
        'Исправлен флаг языка Эсперанто в меню',
        'Кнопки "Поиск игры" и "Сыграть по ссылке" заблокированы для гостей с подсказкой о регистрации',
        'Исправлен скролл чата на мобильных устройствах',
        'Исправлена ошибка синхронизации сообщений в онлайн-чате',
        'Добавлен жест щипка для масштабирования доски на мобильных устройствах',
        '"Загрузить игру" переименовано в "Просмотр партий"',
        'Мобильное меню дополнено пунктами десктопного меню',
        'Добавлен раздел "Что нового?" в настройки',
        'Версия обновлена до v0.9.1',
      ],
      en: [
        'Fixed Esperanto language flag in the menu',
        '"Search game" and "Play by link" buttons disabled for guests with a registration hint',
        'Fixed chat scroll on mobile devices',
        'Fixed message sync bug in online chat',
        'Added pinch-to-zoom gesture for the board on mobile devices',
        '"Load Game" renamed to "View Games"',
        'Mobile menu updated to match desktop menu',
        'Added "What\'s new?" section in settings',
        'Version updated to v0.9.1',
      ],
      eo: [
        'Korektita flago de Esperanto en la menuo',
        '"Serĉi ludon" kaj "Ludi per ligilo" malŝaltitaj por gastoj kun sugesto pri registriĝo',
        'Korektita rulumado de babilejo sur porteblaj aparatoj',
        'Korektita eraro pri sinkronigo de mesaĝoj en reta babilejo',
        'Aldonita gesto de pincxado por zoomi la tabulon sur porteblaj aparatoj',
        '"Ŝargi ludon" renomita al "Vidi ludojn"',
        'Portebla menuo ĝisdatigita laŭ desktopa menuo',
        'Aldonita sekcio "Kio estas nova?" en agordoj',
        'Versio ĝisdatigita al v0.9.1',
      ],
    },
  },
];

export default function WhatsNewModal({ onClose }: WhatsNewModalProps) {
  const { t, language } = useI18n();

  const handleClose = () => {
    markVersionSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.whatsNew}</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-6">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  v{entry.version}
                </span>
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  {entry.date}
                </span>
              </div>
              <ul className="space-y-1.5">
                {entry.changes[language as 'ru' | 'en' | 'eo'].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-indigo-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
