import { useState } from 'react';
import { useI18n } from '../../i18n';
import { Player } from '../../game/types';
import { BOT_SPEEDS, BotGameConfig, PLAY_LEVELS, VS_HUMAN_DELAY_MS, WATCH_BOTS, botLabel } from '../../ai/levels';

interface BotGameModalProps {
  onClose: () => void;
  onStart: (config: BotGameConfig) => void;
}

type Mode = 'play' | 'watch';
type LevelId = (typeof PLAY_LEVELS)[number]['id'];

const choice = (active: boolean) =>
  `transition-colors text-sm ${active
    ? 'bg-indigo-500 text-white'
    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white'}`;

export default function BotGameModal({ onClose, onStart }: BotGameModalProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('play');
  const [boardSize, setBoardSize] = useState<37 | 48 | 61>(48);
  const [level, setLevel] = useState<LevelId>('amateur');
  const [humanPlayer, setHumanPlayer] = useState<Player>('player1');
  const [bot1, setBot1] = useState<string>('greedy');
  const [bot2, setBot2] = useState<string>('safe-random');
  const [speedMs, setSpeedMs] = useState<number>(BOT_SPEEDS[1].ms);

  const levelLabel = (id: LevelId) => (id === 'novice' ? t.botLevelNovice : t.botLevelAmateur);
  const levelHint = (id: LevelId) => (id === 'novice' ? t.botLevelNoviceHint : t.botLevelAmateurHint);

  const start = () => {
    if (mode === 'watch') {
      onStart({ boardSize, bots: { player1: bot1, player2: bot2 }, delayMs: speedMs });
      return;
    }
    const spec = PLAY_LEVELS.find(l => l.id === level)!.spec;
    onStart({
      boardSize,
      bots: humanPlayer === 'player1' ? { player1: null, player2: spec } : { player1: spec, player2: null },
      delayMs: VS_HUMAN_DELAY_MS,
    });
  };

  const botSelect = (label: string, value: string, onChange: (v: string) => void) => (
    <label className="block">
      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        {WATCH_BOTS.map(spec => <option key={spec} value={spec}>{botLabel(t, spec)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">🤖 {t.botGameSetup}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Mode */}
          <div className="flex gap-2">
            {(['play', 'watch'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 rounded-lg font-semibold ${choice(mode === m)}`}>
                {m === 'play' ? t.botModeVsBot : t.botModeWatch}
              </button>
            ))}
          </div>

          {/* Board size */}
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t.chooseBoard}</p>
            <div className="flex gap-2">
              {([37, 48, 61] as const).map(size => (
                <button key={size} onClick={() => setBoardSize(size)} className={`flex-1 py-2 rounded-lg font-semibold ${choice(boardSize === size)}`}>
                  {size}
                </button>
              ))}
            </div>
          </div>

          {mode === 'play' ? (
            <>
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t.botDifficulty}</p>
                <div className="flex gap-2">
                  {PLAY_LEVELS.map(l => (
                    <button key={l.id} onClick={() => setLevel(l.id)} className={`flex-1 py-2 rounded-lg font-semibold ${choice(level === l.id)}`}>
                      {levelLabel(l.id)}
                    </button>
                  ))}
                  <button disabled title={t.botLevelStrongHint} className="flex-1 py-2 rounded-lg font-semibold text-sm bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed">
                    {t.botLevelStrong}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{levelHint(level)}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t.botSide}</p>
                <div className="space-y-2">
                  {(['player1', 'player2'] as Player[]).map(side => (
                    <button key={side} onClick={() => setHumanPlayer(side)} className={`w-full p-3 text-left rounded-lg ${choice(humanPlayer === side)}`}>
                      {side === 'player1' ? t.botSidePlayer1 : t.botSidePlayer2}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {botSelect(t.botWatchPlayer1, bot1, setBot1)}
              {botSelect(t.botWatchPlayer2, bot2, setBot2)}
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">{t.botSpeed}</p>
                <div className="flex gap-2">
                  {BOT_SPEEDS.map(s => (
                    <button key={s.id} onClick={() => setSpeedMs(s.ms)} className={`flex-1 py-2 rounded-lg font-semibold ${choice(speedMs === s.ms)}`}>
                      {s.id === 'fast' ? t.botSpeedFast : s.id === 'normal' ? t.botSpeedNormal : t.botSpeedSlow}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t dark:border-gray-700">
          <button
            onClick={start}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-colors"
          >
            {mode === 'play' ? t.startBotGame : t.botWatchStart}
          </button>
        </div>
      </div>
    </div>
  );
}
