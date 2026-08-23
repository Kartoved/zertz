import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournamentStore } from '../../store/tournamentStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { TournamentSummary } from '../../db/tournamentApi';
import TournamentForm, { TournamentFormValues } from './TournamentForm';

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

function TournamentCard({ tour, now, onOpen }: { tour: TournamentSummary; now: number; onOpen: () => void }) {
  const { t } = useI18n();
  const inc = Math.round(tour.timeControlIncrementMs / 1000);
  const base = Math.round(tour.timeControlBaseMs / 60000);
  const startLabel = new Date(tour.startsAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <button
      onClick={onOpen}
      className="w-full text-left px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-white truncate">
          {tour.scheduleId != null && <span title={t.arenaRecurring}>🔁 </span>}{tour.name}
        </span>
        <StatusPill status={tour.status} />
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">{tour.boardSize}</span>
        <span>⏱ {base}+{inc}</span>
        {tour.berserkEnabled && <span title="Berserk">⚡</span>}
        <span className="ml-auto font-mono">
          {tour.status === 'scheduled' && startLabel}
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
  const { list, create, createRecurring, startListPolling, stopListPolling, isLoading, error } = useTournamentStore();

  const [now, setNow] = useState(Date.now());
  const [showCreate, setShowCreate] = useState(false);

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

  const handleCreate = useCallback(async (v: TournamentFormValues) => {
    try {
      if (v.repeat === 'once') {
        const id = await create({ name: v.name, startsAt: v.startAtMs, durationMin: v.durationMin, boardSize: v.boardSize, berserk: v.berserk });
        setShowCreate(false);
        navigate(`/tournaments/${id}`);
      } else {
        await createRecurring({ name: v.name, freq: v.repeat, firstStartAt: v.startAtMs, durationMin: v.durationMin, boardSize: v.boardSize, berserk: v.berserk });
        setShowCreate(false);
      }
    } catch { /* error surfaced via store */ }
  }, [create, createRecurring, navigate]);

  const section = (title: string, items: TournamentSummary[]) =>
    items.length > 0 && (
      <div className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">{title}</h2>
        <div className="space-y-2">
          {items.map(x => (
            <TournamentCard key={x.id} tour={x} now={now} onOpen={() => navigate(`/tournaments/${x.id}`)} />
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
            <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl" aria-label="Back">←</button>
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

        {!user && <p className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">{t.loginToPlay}</p>}

        {showCreate && user && (
          <div className="mb-6">
            <TournamentForm
              repeatMode="full"
              submitLabel={t.arenaCreate}
              busy={isLoading}
              onSubmit={handleCreate}
              onCancel={() => setShowCreate(false)}
            />
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
