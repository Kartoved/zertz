/**
 * A bot described by a string, so a match can be handed to another process and
 * rebuilt there identically — and so a result always says exactly what played.
 *
 *   random | safe-random | greedy | minimax-easy
 *
 * The search bot will add `fast-<level>[:option=value,…]` here.
 */

import { Bot, greedyBot, minimaxBot, randomBot, safeRandomBot } from './bots';

export function botFromSpec(spec: string): Bot {
  switch (spec) {
    case 'random': return randomBot;
    case 'safe-random': return safeRandomBot;
    case 'greedy': return greedyBot;
    case 'minimax-easy': return minimaxBot('easy');
    case 'minimax-medium': return minimaxBot('medium');
    case 'minimax-hard': return minimaxBot('hard');
    default: throw new Error(`unknown bot: ${spec}`);
  }
}
