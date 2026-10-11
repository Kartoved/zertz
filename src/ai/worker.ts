import { GameState } from '../game/types';
import { botFromSpec } from './botSpec';

// Runs one bot move off the UI thread. `spec` names the bot (botSpec.ts), the
// same strings the arena uses, so a game on the site is played by exactly the
// bot that was measured.
self.onmessage = (e: MessageEvent<{ state: GameState; spec: string }>) => {
  const { state, spec } = e.data;
  // Reconstruct Map (structured clone preserves it, but just in case)
  const gameState: GameState = {
    ...state,
    rings: state.rings instanceof Map ? state.rings : new Map(state.rings as any),
  };

  const move = botFromSpec(spec).pickMove(gameState, gameState.currentPlayer, Math.random);
  self.postMessage({ move });
};
