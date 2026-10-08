import { neighborCoordinates } from "./geometry";
import type { Coordinate } from "./types";

export function computeAdjacency(
  width: number,
  height: number,
  mines: readonly Coordinate[],
): number[] {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new Error(`Invalid size: ${width}x${height}`);
  }

  const counts = new Array<number>(width * height).fill(0);
  const seen = new Set<number>();

  for (const { x, y } of mines) {
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= width ||
      y < 0 ||
      y >= height
    ) {
      throw new Error(
        `Mine at (${x}, ${y}) is outside the ${width}x${height} grid`,
      );
    }
    const index = y * width + x;
    if (seen.has(index)) {
      throw new Error(`Duplicate mine at (${x}, ${y})`);
    }
    seen.add(index);

    for (const n of neighborCoordinates(width, height, x, y)) {
      const i = n.y * width + n.x;
      counts[i] = (counts[i] ?? 0) + 1;
    }
  }
  return counts;
}
