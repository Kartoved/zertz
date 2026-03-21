import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as roomsApi from '../../db/roomsApi';
import { createInitialState } from '../../game/GameEngine';
import { createRootNode } from '../../utils/gameTreeUtils';
import { TIME_CONTROLS } from './MainMenu';
import { useAuthStore } from '../../store/authStore';

export function useMatchmaking() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [searchIntervalId, setSearchIntervalId] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (searchIntervalId) clearInterval(searchIntervalId);
    };
  }, [searchIntervalId]);

  const cancelSearch = async () => {
    if (searchIntervalId) clearInterval(searchIntervalId);
    setSearchIntervalId(null);
    setIsSearchingMatch(false);
    try {
      await roomsApi.leaveMatchmaking();
    } catch (e) {
      console.error('Error leaving search', e);
    }
  };

  const startSearch = async (
    selectedBoardSize: 37 | 48 | 61,
    selectedTimeControl: string,
    onAuthRequired: () => void
  ) => {
    const tc = TIME_CONTROLS.find((c) => c.id === selectedTimeControl);
    if (!tc) return;
    if (!user && tc.preset !== null) {
      onAuthRequired();
      return;
    }
    if (tc.preset === null) return;

    setIsSearchingMatch(true);

    const initialState = createInitialState(selectedBoardSize);
    const rootNode = createRootNode();

    try {
      const res = await roomsApi.joinMatchmaking(selectedBoardSize, tc.id, initialState, rootNode);
      if (res.status === 'matched' && res.roomId) {
        setIsSearchingMatch(false);
        navigate(`/room/${res.roomId}`);
      } else {
        const interval = window.setInterval(async () => {
          try {
            const pollRes = await roomsApi.pollMatchStatus();
            if (pollRes.status === 'matched' && pollRes.roomId) {
              clearInterval(interval);
              setIsSearchingMatch(false);
              setSearchIntervalId(null);
              navigate(`/room/${pollRes.roomId}`);
            }
          } catch (e) {
            console.error('Polling error', e);
          }
        }, 1500);
        setSearchIntervalId(interval);
      }
    } catch (err) {
      console.error('Error joining match', err);
      setIsSearchingMatch(false);
    }
  };

  return {
    isSearchingMatch,
    cancelSearch,
    startSearch,
  };
}
