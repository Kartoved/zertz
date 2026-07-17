# ZEN & ZIP — ZERTZ notation formats (design notes)

> Status: **ZIP + ZEN implemented and wired into the UI** (client-side TS).
>
> - **ZIP** ✅ `src/game/zip.ts` (+ tests). `stateToZip` / `zipToState`.
> - **ZEN** ✅ `src/game/zen.ts` (+ tests). Move tokens (`moveToZen` / `zenToMove`),
>   intrinsic labels (`buildLabels`), and whole-game movetext (`treeToZen` /
>   `zenToTree`) — tags, numbering, `{comments}`, `(variations)`, `[%cal]/[%csl]`
>   annotations ↔ `GameNode.shapes`. Start position rides in a `[ZIP]` tag.
> - **UI** ✅ `NotationButtons` (copy ZIP / export ZEN) in the local game
>   (`ControlPanel`), online room (`RoomScreen` header) and studies
>   (`StudyBoardViewer`). Import via **Play → Import position** (`ImportPositionModal`,
>   auto-detects ZIP vs ZEN) → `gameStore.loadPosition` / `loadTree`. Custom starts
>   navigate correctly via `gameStore.customStart` + `rebuildStateFromNodeWithStart`
>   (verified end-to-end for ZIP import with Playwright).
>
> **Labeling — DECIDED (was open #5):** ZEN uses **intrinsic** algebraic labels
> (leftmost column = `a`, per-column bottom = row 1), from the position's own rings
> — no board-size dependency. `buildLabels(state)` mirrors `idToAlgebraic` and is
> **verified equal** to it on standard full boards. For a game, labels are built
> once from the START position and reused, so a cell keeps its name as neighbours
> are removed.
>
> **Coordinate frame — RESOLVED (variant 1).** `zipToState` now **anchors the
> decoded shape onto the matching standard template** (37/48/61) by pure
> translation (`anchorToTemplate` / `findTranslation`, smallest that fits), so the
> reconstructed board uses the **same absolute ids as the engine**, includes
> removed rings as `isRemoved`, and sets the correct `boardSize` — drop-in for
> `rebuildStateFromNode` / `idToAlgebraic`. A genuinely custom shape that fits no
> template keeps relative coordinates (`inferBoardSize` fallback). This also makes
> ZEN-decoded trees use app coordinates, so **import is unblocked** for standard
> boards.

Two text formats, analogous to chess FEN/PGN:

- **ZEN** — *ZErtz Notation* (also a nod to Forsyth-**E**dwards). The **PGN analog**:
  a whole game (tags + movetext).
- **ZIP** — *Zertz Inline Position* (one-line, "zipped" snapshot; pun on compression).
  The **FEN analog**: a single position, **no moves**.

Naming is settled. Format details below are mostly settled for ZIP; ZEN is still a
rough sketch. Open decisions are collected at the end.

---

## ZIP — position format

### Core principle: self-describing, no board size

We deliberately **do not** store the board size / a template reference. Reasons:
- It's redundant if the layout carries the geometry itself.
- It future-proofs **arbitrary / random-shape boards** (we already played random
  shapes), not just 37/48/61 hexagons.

Consequence: **the layout must encode the geometry itself** — i.e. which cells
exist and which don't. Crucial distinction:

> **"empty ring" ≠ "no ring".** An empty ring is part of the board (can be placed
> on, participates in isolation). A removed/absent cell is a hole.

So there are **three background states**, not two: hole / empty ring / marble.
A ring removed during play and a cell that never existed are indistinguishable in a
ZIP — correct, because ZIP is just a snapshot with no history.

**No frame / no board-size tag.** We considered a size tag and a fixed "always-61"
frame, but rejected both: a number pins a *size*, not a *shape*, and we want full
flexibility for arbitrary/custom boards (different 61-shapes, a future 100-board,
random cutouts). The **layout self-describes the geometry**, so no template/registry
is ever consulted. The hex vertical stagger is the only cost — see below.

### Fields

```
<layout> <pool> <cap1> <cap2> <side>
```

- **layout** — geometry + marbles (see below).
- **pool** — shared supply `W/G/B`, e.g. `6/8/10`.
- **cap1 / cap2** — captures per player, e.g. `2/1/0` and `1/0/1` (absolute:
  player1 then player2, like FEN is absolute).
- **side** — side to move, `1` / `2`.

No move number (FEN's fullmove/halfmove clock is for the 50-move rule &
repetition; ZERTZ has no 50-move rule and can't stall forever — rings & marbles
deplete — so it's dropped).

### Layout encoding (DECIDED — self-describing, FEN-style RLE)

- Columns **left to right**, separated by `/`. Within a column, **bottom to top**
  (a1 is the bottom field).
- Symbols:
  - `o` = **empty ring**.
  - `W` / `G` / `B` = **marble** (uppercase).
  - **digit N = a run of N absent cells (holes)** — RLE, exactly like FEN uses
    digits for empty squares. Used both for a column's **bottom offset** (leading
    digit) and for **internal gaps** (rings removed mid-column).
- Holes **above** a column's topmost ring are **omitted** (column ends at its last
  ring).
- No `x`, no `0`: `o` isn't a digit so a leading offset digit is unambiguous; a
  zero-length run never occurs so `0` never appears.

Why the leading offset matters: the hex lattice is **sheared** — a cell's visual
height depends on both `q` and `r`, so columns sit at different heights. The leading
digit encodes each column's vertical offset (relative to the board's lowest cell),
which is required to reconstruct cross-column **adjacency** (= the whole geometry).
This is the unavoidable cost of flattening a sheared hex into per-column strings; a
symmetric board still gets asymmetric leading digits.

Example — full 37 board, all empty, player 1 to move:
```
oooo/ooooo/oooooo/ooooooo/1oooooo/2ooooo/3oooo 6/8/10 0/0/0 0/0/0 1
```
(columns `e/f/g` carry a leading offset digit from the shear.)

Reading a column, e.g. `2ooWo`: 2 holes → empty → empty → white marble → empty.

### Phase / mid-turn

ZIP represents a **turn-boundary** position. The "capture is mandatory" phase is
**derivable** from the position, so it's not stored. Mid-turn transients (marble
placed but ring not yet removed; middle of a capture chain) are **not** modeled —
we don't snapshot them. Known caveat: re-importing a "ring-removal owed" state
would be read as a fresh turn (the engine wouldn't know a removal is pending). We
accept this; no phase field.

---

## ZEN — game format

### Move token grammar (DECIDED)

Each move (a whole turn) is **one whitespace-free ASCII token** so movetext
tokenizes on spaces like PGN.

| Move type | Token | Example |
|---|---|---|
| Placement | `C‹cell›` | `Wb3` |
| Placement + ring removal | `C‹cell›-‹cell›` | `Wb3-c4` |
| Capture chain | `C‹from›x‹to›x‹to›…` | `Wa4xc4xe5` |
| + captured colors suffix | `…+‹colors›` | `Wa4xc4xe5+wg`, `Wb3-c4+w` |

- `C` = marble color `W/G/B` (uppercase); `cell` = column (lowercase) + row digit
  (`b3`); `colors` = lowercase `w/g/b`.
- Delimiters: `-` = ring removal (placement only), `x` = next jump, `+` = start of
  color suffix. Non-overlapping.
- **Case separates meaning:** uppercase = marble color, lowercase = column /
  captured color. `b`/`g` exist in both column letters and colors, but the suffix
  is hard-opened by `+`, so no ambiguity.
- `x` doesn't clash with columns (`a–i` through the 61 board). *(Caveat: super-wide
  arbitrary boards could reach column `x` — would need another separator then.)*
- **No disambiguation needed** (unlike chess SAN): for a capture, `from`+`to`
  uniquely determine the jumped ring (the one on the straight line between them).

Mandatory (player choices): color, placement cell, removed ring, landing
sequence. **Derivable / optional** (like SAN `+`/`#`): the `+colors` suffix — the
replayer recomputes captured/isolated colors; emit it for readability, verify on
import.

Output uses ASCII `x`; accept `×` as an alias when parsing.

### Movetext

Structurally like PGN: **tag pairs + movetext**.

```
[Event "..."]
[Site "zertz.app"]
[Date "2026.07.16"]
[Player1 "Alice"]
[Player2 "Bob"]
[Result "1-0"]
[ZIP "..."]         ← optional, only if the start position is non-standard (FEN-tag analog)
[TimeControl "..."]

1. Wb3-c4 Gd2 2. Bd4xf4+b Wc2-b2 ... 1-0
```

- Movetext reuses the engine's existing move notation:
  `W b3` (placement), `Wb3 -c4` (placement + ring removal),
  `Wa4×c4×e5 +wg` (capture chain).
- Result: `1-0` / `0-1` / `*` (ongoing). No draws in ZERTZ (resign/timeout are
  still 1-0/0-1).
- Numbered in half-move pairs like PGN.
- Comments `{...}` and variations `(...)` map onto our `GameNode` tree + `comment`
  (studies already do this).
- Annotations (arrows/circles from `Shape[]`) could ride in Lichess-style comment
  tags: `{[%cal Gb3c4][%csl Rc4]}` — we already have the data and brush colors.

---

## Implementation approach (later, not now)

- Live in `shared/` (like `shared/explorer/`) so client and server produce
  **byte-identical** output — needed for import/export and explorer keys.
- Functions: `stateToZIP` / `zipToState`, `treeToZEN` / `zenToTree(meta, tree)`.
- Reuse: `idToAlgebraic`, `moveToNotation`, canonical ring order, and the
  `shared/explorer/replay.js` engine.
- **Missing today:** a **notation parser** (`notation → Move`); only the forward
  `moveToNotation` exists. Needed for ZEN import (and useful for "paste a game").
- Integration points: "copy position" (ZIP) in game/analysis; study import/export
  and `SaveToStudy`; paste-position in `PositionEditorModal`; embedding positions
  in the blog/rules; share links (`?zip=...`).
- Consider making move tokens **whitespace-free** for clean ZEN tokenization
  (`Wb3-c4`, `Wa4xc4xe5+wg`) — maybe a compact notation variant.

---

## Open decisions

1. **ZIP field separator reuse:** `/` separates both layout columns and the
   `W/G/B` triples in pool/captures. Unambiguous (different space-separated
   fields) but worth a conscious OK.
2. **Canonicalization:** keep ZIP *literal* (fixed orientation, like FEN); leave
   symmetry-reduction to the explorer (which already canonicalizes separately).
3. **Rule-variant flag:** currently only standard win conditions; room to add later.
4. **ZEN movetext extras:** comments `{...}`, variations `(...)`, annotations via
   `{[%cal ...][%csl ...]}`, NAGs `$n` — how much to support (default: comments +
   variations + annotations yes, NAGs later).

### Decided

- Names: **ZEN** (game) + **ZIP** (position).
- ZIP: **self-describing, no frame/size tag** (flexibility over compactness —
  supports any/custom/future board shape). Columns `/`-separated, bottom→top;
  `o` = empty ring, `W`/`G`/`B` = marble, **digit = run of N holes (FEN-style RLE)**
  for bottom offset + internal gaps; top holes omitted; no `x`, no `0`. Fields:
  `layout pool cap1 cap2 side`; no move counter. Turn-boundary snapshots only
  (phase derivable, not stored).
- ZEN: whitespace-free ASCII move tokens; capture separator `x` (accept `×`);
  `+colors` suffix optional/derivable; PGN-style numbering with `1...` support;
  comments/variations/annotations yes, NAGs later.

## Future ideas (not started)

- **Export from the online room on mobile** — currently the copy/export buttons
  live in the desktop `RoomScreen` header; add them to the mobile actions sheet.
- **Share a position by link** — `?zip=…` URL param that opens the position (like
  `?watch=1` does for rooms).
- **Port the codec to `shared/`** — move `zip.ts`/`zen.ts` into `shared/` (plain
  JS ESM, like `shared/explorer/`) so the server can use them too: server-side
  validation of imported games, and possibly ZIP/ZEN as human-readable keys
  alongside the explorer hash.
