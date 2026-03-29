import { GameState, Player, WIN_CONDITIONS } from '../game/types';

// Score how close a player is to winning (0–100 scale per condition)
function progressScore(caps: { white: number; gray: number; black: number }): number {
  const whiteProgress = (caps.white / WIN_CONDITIONS.white) * 100;
  const grayProgress = (caps.gray / WIN_CONDITIONS.gray) * 100;
  const blackProgress = (caps.black / WIN_CONDITIONS.black) * 100;
  const mixedProgress = (Math.min(caps.white, caps.gray, caps.black) / WIN_CONDITIONS.allColors) * 100;

  // Raw weighted capture score
  const raw =
    caps.white * 25 +  // 100/4
    caps.gray * 20 +   // 100/5
    caps.black * 17;   // 100/6

  // Bonus for being close to any win condition
  const nearBonus =
    Math.max(whiteProgress, grayProgress, blackProgress, mixedProgress) * 0.5;

  return raw + nearBonus;
}

export function evaluate(state: GameState, botPlayer: Player): number {
  if (state.winner) {
    if (state.winner === botPlayer) return 100_000;
    if (state.winner === 'cancelled') return 0;
    return -100_000;
  }

  const opponent: Player = botPlayer === 'player1' ? 'player2' : 'player1';
  return progressScore(state.captures[botPlayer]) - progressScore(state.captures[opponent]);
}
