/**
 * Single source of truth for ZERTZ's fixed numeric rules.
 *
 * These values were previously copy-pasted across the client engine
 * (src/game/types.ts), the shared replay/validation code, and the server
 * verifier — four literals that had to move together by hand. Consolidated here
 * so a rule change happens in exactly one place. Plain JS so Node, the browser
 * bundle, and the shared modules all import the same constants.
 */

// The fixed marble supply / initial reserve, by color.
export const MARBLE_SUPPLY = { white: 6, gray: 8, black: 10 };

// Capture counts that win the game: enough of one color, or `allColors` of each.
export const WIN_CONDITIONS = { white: 4, gray: 5, black: 6, allColors: 3 };
