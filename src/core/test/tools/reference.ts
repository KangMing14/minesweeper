import type { Coordinate } from "../../types";

/** Cell-driven brute force. Independent of the production mine-driven version. */
export function referenceAdjacency(
  width: number,
  height: number,
  mines: readonly Coordinate[],
): number[] {
  const mineKeys = new Set(mines.map((m) => `${m.x},${m.y}`));
  const counts: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (mineKeys.has(`${x + dx},${y + dy}`)) n++;
        }
      }
      counts.push(n);
    }
  }
  return counts;
}
