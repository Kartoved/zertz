# Building the ZERTZ bot: lessons from Quantum Battle

Quantum Battle (`C:\Users\karto\Desktop\quantum battle`) started as a fork of this
repo and grew a strong bot over September–October 2026. The two games share the
board (hex rings/hexes, free-edge removal, compulsory chained captures), so most
of what was learned there transfers. This file is the short version; the full
record with every number is `quantum battle/docs/BOT_AI.md` — read it, it is on
the same machine. The code is there too: port it rather than re-derive it.

## The one lesson above all others

**Every conclusion about the bot came from measurement, and the measurements
themselves were wrong several times before they were right.** Build the
measuring apparatus first, then the search. In Quantum a whole round of weight
tuning evaporated once the match runner was fixed.

## Measurement: build this first

Port these from `quantum battle/scripts/` and `src/ai/`:

| tool | what it does | why it matters |
|---|---|---|
| `match.ts` + `botSpec.ts` | bot vs bot, bots as spec strings (`fast-medium:forcing=8`), split across all cores, Elo with a pair-level error bar | the only honest strength number |
| `book.ts` / `positions/book.ts` | opening book: random openings kept only when a depth-3 search calls them within ~150 of level | random openings are mostly already decided |
| `blunders.ts` | did it leave something capturable when a fully safe move existed | discriminates where Elo saturates |
| `coverage.ts` | did the candidate generator even produce the move a human played | a move never generated can never be feared |
| `replay.ts` | re-asks the bot at every decision of a recorded game | one exported game > many copied positions |
| `nodes.ts` | node counts at fixed depth per search refinement | ordering/PVS must not change the root score |
| `gamestats.ts` | length, endings, colour balance, "winner was behind" over recorded matches | the bot as a tool to study the RULES |
| `positions/games.ts` | real games against the bot as a regression suite | |

Pitfalls, each of which actually happened:

1. **Two deterministic bots without varied openings play ONE game N times.** The
   seed only reaches random moves; the confidence interval then describes clock
   jitter. Always varied openings, each played with both colour assignments.
2. **Random openings are mostly decided** (median ~0.8 of a piece to one side after
   4 random plies). Pairs then go to whoever drew the good side. Use a book of
   level openings.
3. **Count pairs, not games** (`by pairs` line): the two games of a pair share an
   opening and are not independent.
4. **Never run more jobs than physical cores**, or time budgets stop meaning what
   they say. Keep the PC awake during long runs (`SetThreadExecutionState`).
5. **Tune at the depth the bot plays at.** A threat term was clearly good at 1 ply
   and clearly bad at 2: at one ply it stands in for the search. A bait term was
   −100 Elo on the slow engine and free on the fast one. Change the depth →
   re-measure every weight.
6. **Both easy opponents saturate.** Everything beats `randomBot` 95–100% and ties a
   frozen reference. A "±0" result: suspect the yardstick first.
7. **Keep a FROZEN copy of the evaluation** (`reference/evaluateV1.ts`) as the fixed
   yardstick. Never edit it.
8. **A reward needs its price** or the bot abuses it (a "type can't be lost" bonus
   without a "piece out of the fight" cost lost 63 Elo: the bot hid and lost on
   space).
9. **Better prediction ≠ better play.** Texel tuning cut held-out error
   0.228 → 0.197 and lost ~20 Elo. A term useless as a predictor can be valuable
   as a guide for which forcing lines the search looks at. Tune one term at a time
   against the match.
10. For questions about the RULES (colour balance) use the shortest possible
    openings: a 4-ply book alone produced a fake "second player wins 66%".

## Engine and search: what bought strength, in order of size

1. **Forcing moves: +139 Elo, the largest single gain.** Captures are compulsory,
   so a quiet move that hands the opponent a capture is this family's "check".
   The static ranking never likes such moves (they look like giving material
   away), so generate them explicitly on top of the ranked list:
   - *bait*: put something where the opponent is obliged to take it, so that
     the forced capture lands where we recapture more;
   - *cover*: the opponent already has a capture pending — prepare the square it
     must land on.
   After such a move the reply is forced, so follow it with a **capture
   extension instead of a ply**, and never LMR-reduce a move that leaves the
   opponent a capture. In ZERTZ this is not an extra — sacrifices that force a
   capture sequence ARE the game; expect this to matter even more here.
   (`quantum battle/src/ai/fast/forcing.ts`)
2. **A flat engine: 4–5× nodes/s, +1 ply, +131 Elo at equal time.** Rings
   addressed by `"q,r"` strings in a `Map` of objects are right for the UI and
   hopeless for search. Number the cells, precompute neighbours and the six rays
   per board into typed arrays, a position clones with one `slice`, moves pack
   into an int. (`quantum battle/src/ai/fast/`)
3. **Hold the third engine to the production one ply by ply**
   (`fast/parity.test.ts`): random games with the PRODUCTION engine choosing
   moves, comparing after every ply not only the position but what each believes
   is legal (capture availability, every capture sequence, the removable set).
   When they disagree, the fast one is wrong by definition — even when it is
   "more correct"; changing a rule's meaning is a separate, measured change.
   Also hold the evaluation term by term (`fast/eval.test.ts`).
4. **Candidate generation is where blindness hides.** Coverage showed the bot
   generated almost none of the human's quiet moves. Two causes: the "centre"
   was measured from axial (0,0), which is a RIM cell on these boards — measure
   from the centroid; and long-range/sacrificial moves score badly statically.
   Rank and trim (never sample) placements and removals; free edges depend only
   on which rings are removed, never on marbles, so the removable set updates
   incrementally.
5. **Defensive removals: +53.** The removal after a quiet move can kill an
   opponent's pending capture (remove its landing ring or a ring on its path).
   The static removal ranking never finds this; score removable rings by how
   many pending captures they kill and pair the best 2 with the leading quiet
   moves. In ZERTZ the analogue also includes removals that ISOLATE a group
   (isolation captures).
6. **Material must dominate the evaluation, by an order of magnitude.** When a
   piece was worth about as much as mobility swings, the bot fed pieces on
   purpose: giving material away forces the reply, and a min over 2 forced
   replies beats a min over 56 free ones. ×10 on material stopped it.
7. Smaller, real: killers + history + PVS = 44% fewer nodes (+31, within noise),
   LMR ≈ 0 at depth 3, a transposition table cuts ~10% (the placement phase
   commutes) but buys no strength at branching ~56. Narrowing the frontier to
   gain a ply LOST −78…−139: the frontier is where the baits are seen. Depth must
   come from node speed (profile: capture detection computed once per node, a
   yes/no `hasCaptures` that stops at the first one → +75% nodes/s with
   identical decisions, checked by a fingerprint of 90 fixed-depth searches).
8. Levels are a TIME budget (60 / 700 / 2500 ms), not a depth. Iterative
   deepening; a cut-short iteration's leader is adopted on its own terms; carry
   alpha between root moves.

## Where ZERTZ differs — think before porting

- **Marbles are neutral** and come from a shared pool; when the pool is empty a
  player places from their own captures. A marble's value depends on what BOTH
  players still need (4 white / 5 grey / 6 black, or 3 of each). The evaluation
  is about progress toward each target, convex near completion, not about owned
  pieces.
- **Isolation captures**: removing a ring that cuts off a fully occupied group
  captures it. This is a second capture mechanism the generator must find
  deliberately (an "island" planner in Quantum is the closest relative:
  `fast/islands.ts`).
- **No movement phase**: every turn is a placement + removal or a capture, so the
  branching is placements × 3 colours × removals (~1000+ on a fresh board) all
  game long.
- The forcing/sacrifice structure is the heart of ZERTZ strategy, so the bait
  generator (point 1 above) is likely worth even more than in Quantum.

## Workflow notes

- Record matches with `--record` and keep them (Quantum keeps them in
  `Desktop\quantum-battle-matches\`); the jsonl holds each game as ZEN and
  feeds statistics, Texel, publication to the site's studies library.
- Report results honestly, with error bars; withdraw an earlier conclusion
  outright when a better measurement contradicts it.
