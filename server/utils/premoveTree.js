/**
 * Pre-move TREE model (correspondence games) — pure, DB-free helpers.
 *
 * Storage shape of `rooms.premoves_json`:
 *   {
 *     player1: PreMoveTree | null,
 *     player2: PreMoveTree | null,
 *     notices?: { player1?: Notice, player2?: Notice }
 *   }
 *
 * PreMoveTree = { anchorStateJson, children: PreMoveNode[] }
 * PreMoveNode = { id, move, notation, player, newStateJson, newCurrentPlayer,
 *                 newWinner, newWinType, children: PreMoveNode[] }
 * Notice      = { type: 'fired' | 'pruned', reason?, notation?, at }
 *
 * Invariant (alternating levels): a tree is rooted at the live position where
 * the OWNER is waiting on the opponent. So `tree.children` and the children of
 * any "my" node are OPPONENT moves (many branches); the children of any
 * OPPONENT node are MY response (exactly one).
 *
 * Mirror of the client model in src/game/types.ts and src/store/premovesActions.ts.
 */

export function emptyPremoves() {
  return { player1: null, player2: null, notices: {} };
}

// Structural move equality — robust to JSON key-order differences between the
// stored pre-move node and the just-played game-tree node.
function movesEqual(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'placement') {
    return a.data.marbleColor === b.data.marbleColor
      && a.data.ringId === b.data.ringId
      && (a.data.removedRingId ?? null) === (b.data.removedRingId ?? null);
  }
  if (a.type === 'capture') {
    if (a.data.from !== b.data.from || a.data.to !== b.data.to || a.data.captured !== b.data.captured) {
      return false;
    }
    const aChain = a.data.chain || [];
    const bChain = b.data.chain || [];
    if (aChain.length !== bChain.length) return false;
    for (let i = 0; i < aChain.length; i++) {
      if (aChain[i].from !== bChain[i].from || aChain[i].to !== bChain[i].to || aChain[i].captured !== bChain[i].captured) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function makeLegacyId() {
  return `pm-legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Legacy migration: the old flat array-of-variants ({ sequence: Step[] }[])
// collapses into a tree by prefix-merging equal moves. anchorStateJson was not
// stored back then; it's only used client-side for staleness, and the server
// matches by node.newStateJson, so a placeholder is fine.
function variantsToTree(variants) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const rootChildren = [];
  for (const v of variants) {
    const seq = v && Array.isArray(v.sequence) ? v.sequence : [];
    let siblings = rootChildren;
    for (const step of seq) {
      if (!step || !step.move) continue;
      let match = siblings.find(c => movesEqual(c.move, step.move));
      if (!match) {
        match = {
          id: step.id || makeLegacyId(),
          move: step.move,
          notation: step.notation,
          player: step.player,
          newStateJson: step.newStateJson,
          newCurrentPlayer: step.newCurrentPlayer,
          newWinner: step.newWinner ?? null,
          newWinType: step.newWinType ?? null,
          children: [],
        };
        siblings.push(match);
      }
      siblings = match.children;
    }
  }
  return rootChildren.length > 0 ? { anchorStateJson: '', children: rootChildren } : null;
}

function normalizeTree(val) {
  if (!val) return null;
  if (Array.isArray(val)) return variantsToTree(val); // legacy array form
  if (val && typeof val === 'object' && Array.isArray(val.children)) return val;
  return null;
}

export function parsePremoves(json) {
  let parsed;
  try {
    parsed = JSON.parse(json || '{}');
  } catch {
    return emptyPremoves();
  }
  if (!parsed || typeof parsed !== 'object') return emptyPremoves();
  return {
    player1: normalizeTree(parsed.player1),
    player2: normalizeTree(parsed.player2),
    notices: parsed.notices && typeof parsed.notices === 'object' ? parsed.notices : {},
  };
}

export function setNotice(premoves, side, notice) {
  if (!premoves.notices || typeof premoves.notices !== 'object') premoves.notices = {};
  premoves.notices[side] = { ...notice, at: Date.now() };
}

export function clearNotice(premoves, side) {
  if (premoves.notices && typeof premoves.notices === 'object') {
    delete premoves.notices[side];
  }
}

/**
 * Decide what the owner's pre-move tree should do given the opponent's just-
 * played move. Pure — no DB, no engine (legality is checked later by
 * computePremoveResponse). Returns one of:
 *
 *   { action: 'none' }
 *       no tree / nothing to consider.
 *   { action: 'prune', reason }
 *       opponent went off every planned branch → clear the tree, notify.
 *   { action: 'end' }
 *       matched a branch but no reply is queued → clear quietly.
 *   { action: 'fire', response, expectedPreStateJson, newTree }
 *       fire `response.move`; `newTree` is the subtree below the response that
 *       becomes the new root (deeper branches preserved), or null when empty.
 */
export function selectPremoveResponse(tree, lastMove) {
  if (!tree || !Array.isArray(tree.children) || tree.children.length === 0) {
    return { action: 'none' };
  }
  const matchedOpp = tree.children.find(c => movesEqual(c.move, lastMove));
  if (!matchedOpp) {
    return { action: 'prune', reason: 'no-branch-for-opponent-move' };
  }
  const response = Array.isArray(matchedOpp.children) ? matchedOpp.children[0] : null;
  if (!response) {
    return { action: 'end' };
  }
  const newTree =
    Array.isArray(response.children) && response.children.length > 0
      ? { anchorStateJson: response.newStateJson, children: response.children }
      : null;
  return {
    action: 'fire',
    response,
    expectedPreStateJson: matchedOpp.newStateJson,
    newTree,
  };
}
