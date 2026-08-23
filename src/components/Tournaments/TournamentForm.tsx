import { useState } from 'react';
import { useI18n } from '../../i18n';

export interface TournamentFormValues {
  name: string;
  startAtMs: number;
  durationMin: number;
  boardSize: 37 | 48 | 61;
  berserk: boolean;
  repeat: 'once' | 'daily' | 'weekly';
}

// epoch ms → 'YYYY-MM-DDTHH:MM' in the viewer's local time (for <input datetime-local>).
function msToLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TournamentForm({
  initial, repeatMode, submitLabel, busy, onSubmit, onCancel,
}: {
  initial?: Partial<TournamentFormValues>;
  repeatMode: 'full' | 'series' | 'none';
  submitLabel: string;
  busy?: boolean;
  onSubmit: (v: TournamentFormValues) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [startInput, setStartInput] = useState(msToLocalInput(initial?.startAtMs ?? Date.now() + 60 * 60 * 1000));
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 30);
  const [boardSize, setBoardSize] = useState<37 | 48 | 61>(initial?.boardSize ?? 37);
  const [berserk, setBerserk] = useState(initial?.berserk ?? true);
  const [repeat, setRepeat] = useState<'once' | 'daily' | 'weekly'>(
    initial?.repeat ?? (repeatMode === 'series' ? 'weekly' : 'once')
  );
  const [err, setErr] = useState('');

  const repeatOptions: Array<'once' | 'daily' | 'weekly'> =
    repeatMode === 'full' ? ['once', 'daily', 'weekly']
    : repeatMode === 'series' ? ['daily', 'weekly']
    : [];

  const submit = () => {
    setErr('');
    if (!name.trim()) { setErr(t.arenaName); return; }
    const startAtMs = new Date(startInput).getTime();
    if (!Number.isFinite(startAtMs)) { setErr(t.arenaStartAt); return; }
    onSubmit({
      name: name.trim(), startAtMs, durationMin, boardSize, berserk,
      repeat: repeatMode === 'none' ? 'once' : repeat,
    });
  };

  const label = (r: 'once' | 'daily' | 'weekly') =>
    r === 'once' ? t.arenaRepeatOnce : r === 'daily' ? t.arenaRepeatDaily : t.arenaRepeatWeekly;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={t.arenaName}
        maxLength={60}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white text-sm"
      />

      <label className="block text-xs text-gray-500 dark:text-gray-400">
        {t.arenaStartAt}
        <input
          type="datetime-local"
          value={startInput}
          onChange={e => setStartInput(e.target.value)}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white text-sm"
        />
      </label>

      {repeatOptions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{t.arenaRepeat}</p>
          <div className="flex gap-2">
            {repeatOptions.map(r => (
              <button
                key={r}
                onClick={() => setRepeat(r)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${repeat === r ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'}`}
              >
                {label(r)}
              </button>
            ))}
          </div>
          {repeat === 'weekly' && Number.isFinite(new Date(startInput).getTime()) && (
            <p className="text-[11px] text-gray-400 mt-1 capitalize">
              🔁 {new Date(startInput).toLocaleDateString(undefined, { weekday: 'long' })}
            </p>
          )}
        </div>
      )}

      <label className="block text-xs text-gray-500 dark:text-gray-400">
        {t.arenaDurationMin}
        <input
          type="number" min={5} max={360} value={durationMin}
          onChange={e => setDurationMin(Math.max(5, parseInt(e.target.value, 10) || 5))}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white text-sm"
        />
      </label>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{t.selectBoard}</p>
        <div className="flex gap-2">
          {([37, 48, 61] as const).map(bs => (
            <button
              key={bs}
              onClick={() => setBoardSize(bs)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${boardSize === bs ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'}`}
            >
              {bs}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700 dark:text-gray-300">⚡ {t.arenaBerserk}</span>
        <button
          onClick={() => setBerserk(b => !b)}
          className={`w-10 h-5 rounded-full transition-colors relative ${berserk ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${berserk ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">{t.arenaRatedBlitz}</p>
      {err && <p className="text-sm text-red-500">{err}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {t.cancel}
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold"
        >
          {busy ? '...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
