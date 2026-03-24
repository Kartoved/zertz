import { useI18n } from '../../i18n';

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

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.whatsNew}</h2>
          <button
            onClick={onClose}
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
