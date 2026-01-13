import { Ring } from './types';

// Original 37-hex Zertz board using axial coordinates (q, r)
// This creates a hexagonal shape with 4 rings on each edge
const BOARD_37_COORDS = [
  // Row 0: q = 0 to 3
  { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 },
  // Row 1: q = -1 to 3
  { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }, { q: 3, r: 1 },
  // Row 2: q = -2 to 3
  { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }, { q: 1, r: 2 }, { q: 2, r: 2 }, { q: 3, r: 2 },
  // Row 3: q = -3 to 3 (center row, 7 hexes)
  { q: -3, r: 3 }, { q: -2, r: 3 }, { q: -1, r: 3 }, { q: 0, r: 3 }, { q: 1, r: 3 }, { q: 2, r: 3 }, { q: 3, r: 3 },
  // Row 4: q = -3 to 2
  { q: -3, r: 4 }, { q: -2, r: 4 }, { q: -1, r: 4 }, { q: 0, r: 4 }, { q: 1, r: 4 }, { q: 2, r: 4 },
  // Row 5: q = -3 to 1
  { q: -3, r: 5 }, { q: -2, r: 5 }, { q: -1, r: 5 }, { q: 0, r: 5 }, { q: 1, r: 5 },
  // Row 6: q = -3 to 0
  { q: -3, r: 6 }, { q: -2, r: 6 }, { q: -1, r: 6 }, { q: 0, r: 6 },
];

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
export function idToAlgebraic(id: string): string {
  const { q, r } = idToCoord(id);
  // Map q to column letter: q=-3 -> 'a', q=3 -> 'g'
  const col = String.fromCharCode(97 + q + 3); // 'a' + (q + 3)
  // Map r to row number: r=0 -> 7, r=6 -> 1
  const row = 7 - r;
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

export function createBoard(size: number = 37): Map<string, Ring> {
  const rings = new Map<string, Ring>();
  
  const coords = size === 37 ? BOARD_37_COORDS : BOARD_37_COORDS;
  
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

export function isFreeRing(ringId: string, rings: Map<string, Ring>): boolean {
  const ring = rings.get(ringId);
  if (!ring || ring.isRemoved || ring.marble !== null) {
    return false;
  }
  return countFreeEdges(ringId, rings) >= 2;
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
