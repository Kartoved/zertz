import { GameState } from '../game/types';
import { BotLevel, findBestMove } from './minimax';
import { Player } from '../game/types';

self.onmessage = (e: MessageEvent<{ state: GameState; botPlayer: Player; level: BotLevel }>) => {
  const { state, botPlayer, level } = e.data;
  // Reconstruct Map (structured clone preserves it, but just in case)
  const gameState: GameState = {
    ...state,
    rings: state.rings instanceof Map ? state.rings : new Map(state.rings as any),
  };

  const move = findBestMove(gameState, level, botPlayer);
  self.postMessage({ move });
};
