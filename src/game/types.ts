export type MarbleColor = 'white' | 'gray' | 'black';
export type Player = 'player1' | 'player2';

export interface Marble {
  color: MarbleColor;
}

export interface Ring {
  id: string;
  q: number;
  r: number;
  marble: Marble | null;
  isRemoved: boolean;
}

export interface CaptureMove {
  from: string;
  to: string;
  captured: string;
  marbleColor?: MarbleColor;
  capturedColor?: MarbleColor;
  chain?: CaptureMove[];
}

export interface PlacementMove {
  marbleColor: MarbleColor;
  ringId: string;
  removedRingId: string | null;
  isolatedCaptures?: MarbleColor[];
}

export type Move = 
  | { type: 'placement'; data: PlacementMove }
  | { type: 'capture'; data: CaptureMove };

export interface GameNode {
  id: string;
  moveNumber: number;
  player: Player;
  move: Move | null;
  notation: string;
  children: GameNode[];
  parent: GameNode | null;
  isMainLine: boolean;
  /** Optional markdown annotation on this node — used by Studies for lessons.
   *  Carried transparently by serializeTree/deserializeTree (they spread the node). */
  comment?: string;
}

export interface Captures {
  white: number;
  gray: number;
  black: number;
}

export interface GameState {
  rings: Map<string, Ring>;
  boardSize: 37 | 48 | 61;
  reserve: { white: number; gray: number; black: number };
  currentPlayer: Player;
  captures: {
    player1: Captures;
    player2: Captures;
  };
  phase: 'placement' | 'ringRemoval' | 'capture' | 'gameOver';
  pendingPlacement: { ringId: string; marbleColor: MarbleColor } | null;
  winner: Player | 'cancelled' | null;
  moveNumber: number;
}

export interface BoardConfig {
  size: 37 | 48 | 61;
}

export const INITIAL_RESERVE = {
  white: 6,
  gray: 8,
  black: 10,
};

export const WIN_CONDITIONS = {
  white: 4,
  gray: 5,
  black: 6,
  allColors: 3,
};

// Conditional pre-moves for correspondence games — modelled as a TREE.
//
// Invariant (alternating levels): a node's children are the moves that follow
// it. A tree is rooted at the live position, so `PreMoveTree.children` and the
// children of any "my" node are OPPONENT moves — many, one per branch I plan a
// reply for. The children of any OPPONENT node are MY response — exactly one,
// because from a given position I only ever play one move (the server must know
// what to auto-fire). Arm-from-own-move is handled by playing my first move
// immediately as a real move, so a stored tree's root children are always
// opponent moves.
export interface PreMoveNode {
  id: string;
  move: Move;
  notation: string;
  player: Player;          // who makes this move (player1 or player2)
  newStateJson: string;    // serialized GameState AFTER this move
  newCurrentPlayer: 1 | 2; // whose turn AFTER this move
  newWinner: number | null;
  newWinType: string | null;
  children: PreMoveNode[]; // my node ⇒ ≤1 child; opponent node ⇒ ≥0 children
}

export interface PreMoveTree {
  anchorStateJson: string; // live position this tree is rooted at (staleness check)
  children: PreMoveNode[]; // expected opponent moves (branches) from the anchor
}

export interface PreMovesByPlayer {
  player1: PreMoveTree | null;
  player2: PreMoveTree | null;
}

// Transient server → client message about what happened to my pre-move tree
// (auto-fired a reply, or got pruned because the game diverged). Surfaced as a
// toast; deduped by `at`.
export interface PreMoveNotice {
  type: 'fired' | 'pruned';
  reason?: string;
  notation?: string;
  at: number;
}
