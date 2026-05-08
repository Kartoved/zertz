import { GameNode } from '../game/types';
import { serializeTree, deserializeTree } from '../db/apiClient';

// 7 days. Long enough for casual return-to-game; short enough that stale data
// from finished/abandoned games doesn't accumulate forever.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'zertz-analysis';

export interface SavedAnalysis {
  tree: GameNode;
  currentNodeId: string;
  startNodeId: string;
}

function storageKey(userId: number, roomId: number | string): string {
  return `${KEY_PREFIX}-${userId}-${roomId}`;
}

// Returns null when no saved analysis exists, the entry has expired, or the
// payload fails to parse. Expired entries are cleaned up on read.
export function loadAnalysis(userId: number, roomId: number | string): SavedAnalysis | null {
  const key = storageKey(userId, roomId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    if (!parsed.treeJson || !parsed.currentNodeId || !parsed.startNodeId) return null;
    return {
      tree: deserializeTree(parsed.treeJson),
      currentNodeId: parsed.currentNodeId,
      startNodeId: parsed.startNodeId,
    };
  } catch {
    // Corrupted entry — remove it so we don't keep failing to read it.
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
}

export function saveAnalysis(
  userId: number,
  roomId: number | string,
  data: SavedAnalysis
): void {
  try {
    const payload = {
      treeJson: serializeTree(data.tree),
      currentNodeId: data.currentNodeId,
      startNodeId: data.startNodeId,
      savedAt: Date.now(),
    };
    localStorage.setItem(storageKey(userId, roomId), JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage unavailable — silently drop. Analysis stays
    // alive in memory for the current session.
  }
}

export function clearAnalysis(userId: number, roomId: number | string): void {
  try {
    localStorage.removeItem(storageKey(userId, roomId));
  } catch {
    // ignore
  }
}
