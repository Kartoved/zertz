import { Ring } from './types';

type BoardSize = 37 | 48 | 61;

function generateCoords(rowLengths: number[], startQs: number[]): Array<{ q: number; r: number }> {
  const coords: Array<{ q: number; r: number }> = [];
  for (let r = 0; r < rowLengths.length; r++) {
    const length = rowLengths[r];
    const startQ = startQs[r];
    for (let i = 0; i < length; i++) {
      coords.push({ q: startQ + i, r });
    }
  }
  return coords;
}

const BOARD_COORDS_BY_SIZE: Record<BoardSize, Array<{ q: number; r: number }>> = {
  // Amateur 37 rings (side length 4)
  37: generateCoords(
    [4, 5, 6, 7, 6, 5, 4],
    [0, -1, -2, -3, -3, -3, -3]
  ),
  // Tournament 48 rings (side length 4, extended middle band)
  48: generateCoords(
    [4, 5, 6, 7, 8, 7, 6, 5],
    [0, -1, -2, -3, -4, -4, -4, -4]
  ),
  // Tournament 61 rings (side length 5)
  61: generateCoords(
    [5, 6, 7, 8, 9, 8, 7, 6, 5],
    [0, -1, -2, -3, -4, -4, -4, -4, -4]
  ),
};

function getBoardBounds(size: BoardSize): { minQ: number; maxR: number } {
  const coords = BOARD_COORDS_BY_SIZE[size];
  let minQ = Infinity;
  let maxR = -Infinity;
  for (const coord of coords) {
    minQ = Math.min(minQ, coord.q);
    maxR = Math.max(maxR, coord.r);
  }
  return { minQ, maxR };
}

// Axial hex directions for neighbors
const HEX_DIRECTIONS = [
  { q: 1, r: 0 },   // East
  { q: 1, r: -1 },  // NE
  { q: 0, r: -1 },  // NW
  { q: -1, r: 0 },  // West
  { q: -1, r: 1 },  // SW
  { q: 0, r: 1 },   // SE
];

export function coordToId(q: number, r: number): string {
  return `${q},${r}`;
}

export function idToCoord(id: string): { q: number; r: number } {
  const [q, r] = id.split(',').map(Number);
  return { q, r };
}

// Convert axial coords to algebraic notation for display (a1, b2, etc.)
export function idToAlgebraic(id: string, boardSize: BoardSize = 37): string {
  const { q, r } = idToCoord(id);
  const { minQ, maxR } = getBoardBounds(boardSize);
  const col = String.fromCharCode(97 + (q - minQ));
  const row = maxR + 1 - r;
  return `${col}${row}`;
}

export function getNeighborIds(ringId: string, rings: Map<string, Ring>): string[] {
  const { q, r } = idToCoord(ringId);
  const neighbors: string[] = [];
  
  for (const dir of HEX_DIRECTIONS) {
    const neighborId = coordToId(q + dir.q, r + dir.r);
    const neighbor = rings.get(neighborId);
    if (neighbor && !neighbor.isRemoved) {
      neighbors.push(neighborId);
    }
  }
  
  return neighbors;
}

export function getRingBehind(
  fromId: string,
  middleId: string,
  rings: Map<string, Ring>
): string | null {
  const from = idToCoord(fromId);
  const middle = idToCoord(middleId);
  
  const dq = middle.q - from.q;
  const dr = middle.r - from.r;
  
  const behindId = coordToId(middle.q + dq, middle.r + dr);
  const behind = rings.get(behindId);
  
  return behind && !behind.isRemoved ? behindId : null;
}

export function createBoard(size: BoardSize = 37): Map<string, Ring> {
  const rings = new Map<string, Ring>();
  const coords = BOARD_COORDS_BY_SIZE[size];
  
  for (const coord of coords) {
    const id = coordToId(coord.q, coord.r);
    rings.set(id, {
      id,
      q: coord.q,
      r: coord.r,
      marble: null,
      isRemoved: false,
    });
  }
  
  return rings;
}

export function countFreeEdges(ringId: string, rings: Map<string, Ring>): number {
  const { q, r } = idToCoord(ringId);
  let freeEdges = 0;
  
  for (const dir of HEX_DIRECTIONS) {
    const neighborId = coordToId(q + dir.q, r + dir.r);
    const neighbor = rings.get(neighborId);
    if (!neighbor || neighbor.isRemoved) {
      freeEdges++;
    }
  }
  
  return freeEdges;
}

export function hasTwoAdjacentFreeEdges(ringId: string, rings: Map<string, Ring>): boolean {
  const { q, r } = idToCoord(ringId);
  const free: boolean[] = [];
  
  for (const dir of HEX_DIRECTIONS) {
    const neighborId = coordToId(q + dir.q, r + dir.r);
    const neighbor = rings.get(neighborId);
    free.push(!neighbor || neighbor.isRemoved);
  }
  
  for (let i = 0; i < free.length; i++) {
    const next = (i + 1) % free.length;
    if (free[i] && free[next]) return true;
  }
  
  return false;
}

export function isFreeRing(ringId: string, rings: Map<string, Ring>): boolean {
  const ring = rings.get(ringId);
  if (!ring || ring.isRemoved || ring.marble !== null) {
    return false;
  }
  return hasTwoAdjacentFreeEdges(ringId, rings);
}

export function wouldDisconnectBoard(ringId: string, rings: Map<string, Ring>): boolean {
  const tempRings = new Map(rings);
  const ring = tempRings.get(ringId);
  if (!ring) return true;
  
  ring.isRemoved = true;
  
  const activeRings = Array.from(tempRings.values()).filter(r => !r.isRemoved);
  if (activeRings.length === 0) return false;
  
  const visited = new Set<string>();
  const queue = [activeRings[0].id];
  visited.add(activeRings[0].id);
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const neighbors = getNeighborIds(currentId, tempRings);
    
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }
  
  ring.isRemoved = false;
  
  return visited.size !== activeRings.length;
}

export function getValidRemovableRings(rings: Map<string, Ring>): string[] {
  const removable: string[] = [];
  
  for (const [id, ring] of rings) {
    if (!ring.isRemoved && ring.marble === null && isFreeRing(id, rings)) {
      // Allow removal even if it disconnects the board (isolation is allowed in Zertz)
      // Isolated groups with only marbles will be captured
      removable.push(id);
    }
  }
  
  return removable;
}

export function getIsolatedGroups(rings: Map<string, Ring>): string[][] {
  const activeRings = Array.from(rings.values()).filter(r => !r.isRemoved);
  const visited = new Set<string>();
  const groups: string[][] = [];
  
  for (const ring of activeRings) {
    if (visited.has(ring.id)) continue;
    
    const group: string[] = [];
    const queue = [ring.id];
    visited.add(ring.id);
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      group.push(currentId);
      
      const neighbors = getNeighborIds(currentId, rings);
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

// Flat-top hex to pixel conversion using axial coordinates (q, r)
export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  // Flat-top orientation: sides face up/down
  const x = size * (3/2 * q);
  const y = size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
  return { x, y };
}
