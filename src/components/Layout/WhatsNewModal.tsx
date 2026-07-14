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
    version: '0.15.0',
    date: '2026-07-15',
    changes: {
      ru: [
        '🎓 Студии — новый раздел в «Обучение»: интерактивные учебники с ветками ходов, markdown-комментариями и произвольными позициями. Notion-подобная бесконечная вложенность, публичные студии, клонирование к себе одной кнопкой',
        'Студии: редактор произвольной позиции с контролем баланса шариков (6/8/10), простановкой уже взятых, выбором стороны хода и размера доски',
        'Студии: автосохранение авторских ходов и комментариев (без кнопки «Сохранить»); читатели свободно изучают ветки, но их правки не сохраняются',
        'Студии: из любой партии текущую позицию можно сохранить в студию одной кнопкой «📚 В студию»',
        '📺 ZERTZ TV — на главном экране крупная живая доска с идущими партиями (слайдер + автолистание); если живых партий нет — реплей последней завершённой',
        'Международность: превью ссылок и имя приложения теперь на английском',
        'В правилах единый термин «резерв» вместо смеси «резерв/запас»',
        'В начале партии показывается только «Аннулировать» — кнопка «Сдаться» больше не дублируется',
        'Версия обновлена до v0.15.0',
      ],
      en: [
        '🎓 Studies — a new section under “Learning”: interactive lessons with move branches, markdown comments and arbitrary positions. Notion-like infinite nesting, public studies, one-click clone to yourself',
        'Studies: arbitrary position editor with marble-supply balance control (6/8/10), preset captured marbles, side to move and board size',
        'Studies: autosave of the author’s moves and comments (no “Save” button); readers freely explore branches but their edits are not saved',
        'Studies: save the current position from any game into a study with one “📚 To study” button',
        '📺 ZERTZ TV — a large live board on the main screen broadcasting ongoing games (slider + auto-advance); when nothing is live, it replays the last finished game',
        'Going international: link previews and the app name are now in English',
        'Rules now use one term for the shared pool',
        'At the start of a game only “Cancel” is shown — the “Resign” button is no longer duplicated',
        'Version updated to v0.15.0',
      ],
      eo: [
        '🎓 Studioj — nova sekcio sub «Lernado»: interagaj lecionoj kun movbranĉoj, markdown-komentoj kaj arbitraj pozicioj. Notion-simila senfina ingado, publikaj studioj, unuklaka kopiado al vi',
        'Studioj: redaktilo de arbitra pozicio kun kontrolo de globa provizo (6/8/10), antaŭagorditaj kaptitaj globoj, vicanto kaj tabulgrandeco',
        'Studioj: aŭtomata konservado de movoj kaj komentoj de la aŭtoro (sen butono «Konservi»); legantoj libere esploras branĉojn, sed iliaj ŝanĝoj ne konserviĝas',
        'Studioj: konservu la aktualan pozicion el iu ajn ludo en studion per unu butono «📚 Al studio»',
        '📺 ZERTZ TV — granda viva tabulo sur la ĉefekrano kun daŭrantaj ludoj (ŝovilo + aŭtomata paĝumado); kiam nenio vivas — ripeto de la lasta finita ludo',
        'Internacieco: ligilaj antaŭrigardoj kaj la nomo de la aplikaĵo nun en la angla',
        'La reguloj nun uzas unu terminon por la komuna provizo',
        'Komence de ludo montriĝas nur «Nuligi» — la butono «Kapitulaci» ne plu duobliĝas',
        'Versio ĝisdatigita al v0.15.0',
      ],
    },
  },
  {
    version: '0.14.0',
    date: '2026-05-14',
    changes: {
      ru: [
        'Безопасность: закрыты auth-дыры в серверных роутах; состояние партии теперь верифицируется на сервере через replay-движок — фальсификация захватов или победы невозможна',
        'Рейтинг: победа по таймауту теперь корректно обновляет Glicko-2; идемпотентная защита от двойного начисления',
        'Поллинг: HEAD-запрос перед полным fetch — ~90% запросов в ожидающих партиях стали лёгкими; глобальный чат пагинирован (последние 50 + кнопка «ранее»)',
        'Очередь матчмейкинга перенесена из памяти процесса в БД — выживает при перезапуске сервера',
        'Rate limiting на авторизацию, ходы и создание комнат',
        'Фикс: выбор ветки в цепочке взятий — теперь всегда выбирается правильная цепочка при развилке',
        'Фикс: зависание в фазе «удаление кольца» если колец нет — авто-пропуск',
        'Фикс: победа по таймауту корректно отражается в рейтинге',
        'Множество мелких исправлений: подсветки взятий, ID нод дерева, сброс состояния после хода',
        'Версия обновлена до v0.14.0',
      ],
      en: [
        'Security: auth holes in server routes closed; game state is now verified server-side via replay engine — faking captures or a win is no longer possible',
        'Rating: timeout wins now correctly update Glicko-2; idempotent guard against double rating',
        'Polling: HEAD request before full fetch — ~90% of requests in waiting games are now lightweight; global chat paginated (last 50 + load earlier)',
        'Matchmaking queue moved from process memory to DB — survives server restarts',
        'Rate limiting on auth, moves and room creation',
        'Fix: capture chain branch selection — correct chain always chosen at a fork',
        'Fix: stuck ring-removal phase when no rings are available — auto-skip',
        'Fix: timeout win now reflected in player ratings',
        'Many small fixes: capture highlights, node IDs, state reset after moves',
        'Version updated to v0.14.0',
      ],
      eo: [
        'Sekureco: fermitaj aŭtentikigaj truoj en servilaj vojoj; ludstato nun kontrolata servile per ripeto — falsigi kaptojn aŭ venkon ne plu eblas',
        'Rangotaksado: venko per tempolimo nun ĝuste ĝisdatigas Glicko-2',
        'Balotado: HEAD-peto antaŭ plena alŝuto — ~90% petoj en atendantaj ludoj nun estas malpezaj; tutmonda babilejo paginita',
        'Atendovico de paro translokita el procezmemoro al datumbazo',
        'Indiclimigoj sur aŭtentikigo, movoj kaj kreado de ĉambroj',
        'Riparo: elekto de branĉo en kaptovico — ĉiam elektiĝas ĝusta ĉeno ĉe disbranĉiĝo',
        'Riparo: blokiĝo en fazo «forigi ringon» kiam neniu ringo haveblas — aŭtomata preteriro',
        'Multaj malgrandaj riparoj: reliefiĝoj de kaptoj, nodaj IDoj, restarigo de stato post movo',
        'Versio ĝisdatigita al v0.14.0',
      ],
    },
  },
  {
    version: '0.12.4',
    date: '2026-05-13',
    changes: {
      ru: [
        'Просмотр партий → Архив теперь грузится сразу, счётчик «Архив (N)» виден без открытия таба',
        'Модалка «Партии» в профиле игрока пересобрана: два таба «Активные / Завершённые» со счётчиками + фильтр «только этот игрок / все игроки»',
        'Подпись «Рейтинговая статистика» добавлена и в карточку профиля в лобби, и в модалку «Мой профиль»',
        'Анализ: фаза партии («ход, удаление кольца, взятие») и подсветка активного игрока на десктопе теперь следуют за вариантом, а не за live-игрой',
        'Локальный журнал ходов получил то же оформление, что и онлайн: одна строка с горизонтальным скроллом, авто-прокрутка к текущему ходу, маркер исхода',
        'Превью партии (на главной) — больше не показывает «N ходов» с off-by-one и захардкоженной русской подписью',
        'Фикс: «зависшие» партии (когда комната удалена, но запись в games таблице осталась) больше не появляются в списке активных',
        'Полировка: rated по умолчанию во всех способах создания игры, единообразно',
        'Версия обновлена до v0.12.4',
      ],
      en: [
        'View Games → Archive now loads upfront, the count "Archive (N)" is visible without opening the tab',
        'Player profile → Games modal rebuilt: two tabs "Active / Finished" with counts + filter "this player only / all players"',
        '"Rated stats" label added to the lobby profile card and the My Profile modal',
        'Analysis: game phase ("place a marble, remove a ring, capture") and active-player highlight on desktop now follow the variant, not the live game',
        'Local move history matches the online one: single-line horizontal scroll, auto-scroll to the current move, outcome marker',
        'Mini game preview no longer shows "N moves" with an off-by-one and a hard-coded Russian label',
        'Fix: stuck games (server room deleted but the games table entry stayed) no longer appear in the active list',
        'Polish: rated by default consistently across all game creation paths',
        'Version updated to v0.12.4',
      ],
      eo: [
        'Vidi ludojn → Arkivo nun ŝargiĝas tuj, la kalkulilo «Arkivo (N)» videblas sen malfermi la langeton',
        'Modalo «Ludoj» en ludanta profilo refarita: du langetoj «Aktivaj / Finitaj» kun kalkuliloj + filtrilo «nur ĉi tiu ludanto / ĉiuj ludantoj»',
        'Etikedo «Taksata statistiko» aldonita al la profilkarto en vestiblo kaj al la modalo «Mia profilo»',
        'Analizo: ludofazo («meti globon, forigi ringon, kapti») kaj reliefigo de aktiva ludanto sur komputilo nun sekvas la varianton, ne la vivan ludon',
        'Loka movhistorio konformas al la reta: unu linio kun horizontala rulumado, aŭtomata rulumo al la nuna movo, rezultmarko',
        'Miniaturo de ludo ne plu montras «N movoj» kun erara kalkulo kaj malmolkodita rusa etikedo',
        'Riparo: blokitaj partioj (kiam ĉambro forigita, sed enskribo en tabelo games restis) ne plu aperas en aktiva listo',
        'Polurado: taksata defaŭlte ĉie konsekvence',
        'Versio ĝisdatigita al v0.12.4',
      ],
    },
  },
  {
    version: '0.12.0',
    date: '2026-05-13',
    changes: {
      ru: [
        'Мобильный экран партии переделан: компактные стрипы игроков сверху/снизу, доска занимает максимум места, действия Undo/Resign/Analysis спрятаны в меню «⋯»',
        'Журнал ходов теперь однострочный с горизонтальным скроллом и авто-прокруткой к текущему ходу; скроллбар скрыт',
        'Маркер исхода партии в журнале: ⚪/🔘/⚫ — победа по цвету, 🎨 — смешанная, ⏱ — по времени, 🏳 — сдача, ✕ — отменена',
        'Pre-moves в анализе: теперь видно превью текущего варианта прямо в списке (зелёная пунктирная плашка) — понятно, что именно сохранится',
        'Pre-moves вынесены в отдельный таб «План» в правом сайдбаре (десктоп) и в нижней навигации (мобилка) — доска перестала ужиматься',
        'Анализ: дерево вариантов теперь корректно перерисовывается после твоих ходов в варианте',
        'Анализ: захваты игроков отображаются для варианта, а не только для основной партии',
        'Анализ: после победы в варианте больше не открывается модалка — просто прекращаются ходы',
        'Все онлайн-игры теперь рейтинговые по умолчанию (challenge, профиль, лобби); статистика побед/поражений считает только рейтинговые партии',
        'Фикс: в активных играх показывалось «2 хода» вместо «1»',
        'Фикс: количество игр в профиле учитывает реальные партии, а не только рейтинговые без учёта истории',
        'Версия обновлена до v0.12.0',
      ],
      en: [
        'Mobile game screen redesigned: compact player strips above and below the board, board takes the maximum space, Undo/Resign/Analysis moved to a "⋯" sheet',
        'Move history is now a single horizontal line with auto-scroll to the current move; scrollbar hidden',
        'Game outcome marker in move history: ⚪/🔘/⚫ for color wins, 🎨 for mixed, ⏱ for timeout, 🏳 for resignation, ✕ for cancelled',
        'Pre-moves in analysis: a draft preview of the current variant is shown right in the list (dashed green chip) — you can see exactly what will be saved',
        'Pre-moves moved into a dedicated "Plan" tab in the right sidebar (desktop) and bottom nav (mobile) — the board no longer shrinks',
        'Analysis: variant tree now re-renders correctly after your moves in a variant',
        'Analysis: player captures reflect the current variant, not only the main game',
        'Analysis: no winner modal appears after a victory in a variant — moves just stop being accepted',
        'Online games are now rated by default (challenges, profile invites, lobby); profile win/loss stats count rated games only',
        'Fix: active-games list showed "2 moves" instead of "1"',
        'Fix: profile game count now reflects real history, not just rated wins+losses',
        'Version updated to v0.12.0',
      ],
      eo: [
        'Poŝtelefona ludekrano refarita: kompaktaj ludantostriaĵoj supre/sube, tabulo okupas maksimuman lokon, agoj Undo/Resign/Analizo kaŝitaj en menuo «⋯»',
        'Movhistorio nun unulinia kun horizontala rulumado kaj aŭtomata rulumo al la aktuala movo; rulumstango kaŝita',
        'Marko de rezulto en movhistorio: ⚪/🔘/⚫ por venkoj per koloro, 🎨 por miksita, ⏱ por tempolimo, 🏳 por kapitulaco, ✕ por nuligo',
        'Antaŭmovoj en analizo: antaŭrigardo de la nuna varianto videblas rekte en la listo (verda streketa plaketo) — klaras kio ĝuste konserviĝos',
        'Antaŭmovoj movitaj al aparta langeto «Plano» en la dekstra flanka panelo (komputilo) kaj suba navigado (poŝtelefono) — la tabulo ne plu ŝrumpas',
        'Analizo: variantaarbo nun ĝuste retradiĝas post viaj movoj en varianto',
        'Analizo: kaptaĵoj de ludantoj reflektas la nunan varianton, ne nur la ĉefan ludon',
        'Analizo: post venko en varianto modalo ne plu aperas — movoj simple ĉesas esti akceptataj',
        'Retaj ludoj nun defaŭlte taksataj (defioj, invitoj el profilo, vestiblo); statistiko de venkoj/malvenkoj kalkulas nur taksatajn partiojn',
        'Riparo: en aktivaj ludoj montriĝis «2 movoj» anstataŭ «1»',
        'Riparo: nombro de ludoj en profilo nun reflektas realan historion, ne nur taksatajn venkojn+malvenkojn',
        'Versio ĝisdatigita al v0.12.0',
      ],
    },
  },
  {
    version: '0.10.0',
    date: '2026-05-09',
    changes: {
      ru: [
        'Дебютный обозреватель: в режиме анализа отображаются ходы из текущей позиции с количеством сыгравших и процентами побед, фильтр «только мои партии» и клик по ходу для добавления ветки',
        'Анализ для зрителей: любой залогиненный игрок может параллельно анализировать чужую партию со своими приватными ветками',
        'Live-обновления в анализе: пока изучаете активную партию других игроков, их реальные ходы появляются в вашем дереве, тост уведомляет о новом ходе',
        'Сессии анализа сохраняются в браузере на 7 дней — закрыли вкладку, вернулись позже, ваше дерево на месте',
        'Анализ доступен в любой партии — live, correspondence, завершённой (раньше был только в correspondence)',
        'Зрители больше не получают приглашение занять место при входе в чужую партию из списка',
        'Версия обновлена до v0.10.0',
      ],
      en: [
        'Opening explorer: while analyzing, see moves played from the current position with game counts and win percentages; filter to your own games and click any move to add a branch',
        'Spectator analysis: any logged-in player can analyze someone else\'s game in parallel with private branches',
        'Live updates during analysis: as you study an ongoing game, real moves appear in your analysis tree, with a toast on each new move',
        'Analysis sessions persist in your browser for 7 days — close the tab and come back later, your tree is still there',
        'Analyze any game now — live, correspondence, or finished (previously correspondence only)',
        'Spectators no longer receive a "Take this seat?" prompt when entering someone\'s game from a games list',
        'Version updated to v0.10.0',
      ],
      eo: [
        'Malfermaĵa esplorilo: dum analizo videblas movoj el la nuna pozicio kun nombroj de partioj kaj procentoj de venkoj; filtrilo «nur miaj partioj» kaj alklako por aldoni branĉon',
        'Spektanta analizo: iu ajn ensalutinta ludanto povas paralele analizi alies partion kun privataj branĉoj',
        'Vivaj ĝisdatigoj dum analizo: dum vi studas daŭrantan partion, realaj movoj aperas en via analiza arbo kun tosta sciigo pri ĉiu nova movo',
        'Analizaj sesioj konserviĝas en via retumilo dum 7 tagoj — fermu la langeton kaj revenu poste, via arbo ankoraŭ estas tie',
        'Analizu ajnan partion nun — vivan, korespondan, aŭ finitan (antaŭe nur korespondan)',
        'Spektantoj ne plu ricevas peton «Preni ĉi tiun sidlokon?» kiam ili eniras alies partion el luda listo',
        'Versio ĝisdatigita al v0.10.0',
      ],
    },
  },
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
