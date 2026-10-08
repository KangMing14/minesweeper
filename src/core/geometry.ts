import type { Coordinate } from "./types";

const NEIGHBOR_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export function neighborCoordinates(
  width: number,
  height: number,
  x: number,
  y: number,
): Coordinate[] {
  const result: Coordinate[] = [];
  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      result.push({ x: nx, y: ny });
    }
  }
  return result;
}
