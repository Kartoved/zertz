import { useEffect, useState } from 'react';
import { getTournamentGames, TournamentLiveGame, TournamentFinishedGame } from '../../db/tournamentApi';

const POLL_MS = 4000;

// Polls a tournament's games (live + finished) on its own interval, separate
// from the 3s detail poll so the detail payload stays lean (live games carry
// serialized board state). Mirrors useTvGames: keeps stale data on error.
export function useTournamentGames(id: number): { live: TournamentLiveGame[]; finished: TournamentFinishedGame[] } {
  const [live, setLive] = useState<TournamentLiveGame[]>([]);
  const [finished, setFinished] = useState<TournamentFinishedGame[]>([]);

  useEffect(() => {
    if (!Number.isInteger(id)) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const { live: l, finished: f } = await getTournamentGames(id);
        if (cancelled) return;
        setLive(l);
        setFinished(f);
      } catch {
        /* keep last data on transient errors */
      }
    };
    refresh();
    const iv = setInterval(refresh, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [id]);

  return { live, finished };
}
