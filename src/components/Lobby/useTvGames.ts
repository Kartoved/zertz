import { useEffect, useState } from 'react';
import { getTvGames, TvLiveGame, TvFallbackGame } from '../../db/roomsApi';

const POLL_MS = 4500;

export interface TvGames {
  live: TvLiveGame[];
  fallback: TvFallbackGame | null;
}

// Single source of ZERTZ TV data — polled once in MainMenu and shared by both
// LiveGamesTV instances (desktop left column + mobile TV tab) plus the mobile
// tab's "live" badge, so there's exactly one poll regardless of how many
// consumers render.
export function useTvGames(): TvGames {
  const [live, setLive] = useState<TvLiveGame[]>([]);
  const [fallback, setFallback] = useState<TvFallbackGame | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const { live: l, fallback: fb } = await getTvGames();
        if (cancelled) return;
        setLive(l);
        setFallback(l.length === 0 ? fb : null);
      } catch {
        /* keep last data on transient errors */
      }
    };
    refresh();
    const iv = setInterval(refresh, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return { live, fallback };
}
