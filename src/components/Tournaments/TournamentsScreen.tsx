import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournamentStore } from '../../store/tournamentStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { TournamentSummary } from '../../db/tournamentApi';

function fmtCountdown(target: number, now: number): string {
  const ms = Math.max(0, target - now);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StatusPill({ status }: { status: TournamentSummary['status'] }) {
  const { t } = useI18n();
  const map = {
    scheduled: { label: t.arenaStatusScheduled, cls: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' },
    active: { label: t.arenaStatusActive, cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
    finished: { label: t.arenaStatusFinished, cls: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
  }[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${map.cls}`}>{map.label}</span>;
}

function TournamentCard({ t: tour, now, onOpen }: { t: TournamentSummary; now: number; onOpen: () => void }) {
  const { t } = useI18n();
  const inc = Math.round(tour.timeControlIncrementMs / 1000);
  const base = Math.round(tour.timeControlBaseMs / 60000);
  return (
    <button
      onClick={onOpen}
      className="w-full text-left px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-white truncate">{tour.name}</span>
        <StatusPill status={tour.status} />
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">{tour.boardSize}</span>
        <span>⏱ {base}+{inc}</span>
        {tour.berserkEnabled && <span title="Berserk">⚡</span>}
        <span className="ml-auto font-mono">
          {tour.status === 'scheduled' && `${t.arenaStartsIn} ${fmtCountdown(tour.startsAt, now)}`}
          {tour.status === 'active' && `${t.arenaTimeLeft} ${fmtCountdown(tour.finishesAt, now)}`}
        </span>
      </div>
    </button>
  );
}

export default function TournamentsScreen() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { list, create, startListPolling, stopListPolling, error } = useTournamentStore();

  const [now, setNow] = useState(Date.now());
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [startsInMin, setStartsInMin] = useState(5);
  const [durationMin, setDurationMin] = useState(30);
  const [boardSize, setBoardSize] = useState<37 | 48 | 61>(37);
  const [berserk, setBerserk] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  useEffect(() => {
    startListPolling();
    return () => stopListPolling();
  }, [startListPolling, stopListPolling]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const active = list.filter(x => x.status === 'active');
  const upcoming = list.filter(x => x.status === 'scheduled');
  const finished = list.filter(x => x.status === 'finished');

  const handleCreate = useCallback(async () => {
    setCreateErr('');
    if (!name.trim()) { setCreateErr(t.arenaName); return; }
    setCreating(true);
    try {
      const id = await create({
        name: name.trim(),
        startsAt: Date.now() + startsInMin * 60 * 1000,
        durationMin,
        boardSize,
        berserk,
      });
      setShowCreate(false);
      setName('');
      navigate(`/tournaments/${id}`);
    } catch (err: any) {
      setCreateErr(err.message || 'Error');
    } finally {
      setCreating(false);
    }
  }, [name, startsInMin, durationMin, boardSize, berserk, create, navigate, t]);

  const section = (title: string, items: TournamentSummary[]) =>
    items.length > 0 && (
      <div className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">{title}</h2>
        <div className="space-y-2">
          {items.map(x => (
            <TournamentCard key={x.id} t={x} now={now} onOpen={() => navigate(`/tournaments/${x.id}`)} />
          ))}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl"
              aria-label="Back"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">🏆 {t.tournaments}</h1>
          </div>
          {user && !showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              + {t.arenaCreate}
            </button>
          )}
        </div>

        {!user && (
          <p className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">{t.loginToPlay}</p>
        )}

        {/* Create form */}
        {showCreate && user && (
          <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.arenaName}
              maxLength={60}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white text-sm"
            />
            <div className="flex gap-3">
              <label className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                {t.arenaStartsInMin}
                <input type="number" min={0} max={1440} value={startsInMin}
                  onChange={e => setStartsInMin(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white text-sm" />
              </label>
              <label className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                {t.arenaDurationMin}
                <input type="number" min={5} max={360} value={durationMin}
                  onChange={e => setDurationMin(Math.max(5, parseInt(e.target.value, 10) || 5))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white text-sm" />
              </label>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{t.selectBoard}</p>
              <div className="flex gap-2">
                {([37, 48, 61] as const).map(bs => (
                  <button key={bs} onClick={() => setBoardSize(bs)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${boardSize === bs ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'}`}>
                    {bs}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">⚡ {t.arenaBerserk}</span>
              <button onClick={() => setBerserk(b => !b)}
                className={`w-10 h-5 rounded-full transition-colors relative ${berserk ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${berserk ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t.arenaRatedBlitz}</p>
            {createErr && <p className="text-sm text-red-500">{createErr}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                {t.cancel}
              </button>
              <button onClick={handleCreate} disabled={creating}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold">
                {creating ? '...' : t.arenaCreate}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mb-3 text-sm text-red-500 text-center">{error}</p>}

        {section(t.arenaSectionActive, active)}
        {section(t.arenaSectionUpcoming, upcoming)}
        {section(t.arenaSectionFinished, finished)}

        {list.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-12">{t.arenaEmpty}</p>
        )}
      </div>
    </div>
  );
}
