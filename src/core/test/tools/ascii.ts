import type { BoardSnapshot, Coordinate } from "../../types";

export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly mines: Coordinate[];
}

/** '*' = mine, any other character = safe. All rows must have equal length. */
export function parseLayout(rows: readonly string[]): Layout {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const mines: Coordinate[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Row ${y} has length ${row.length}, expected ${width}`);
    }
    [...row].forEach((ch, x) => {
      if (ch === "*") mines.push({ x, y });
    });
  });
  return { width, height, mines };
}

function glyph(isMine: boolean, count: number): string {
  if (isMine) return "*";
  return count === 0 ? "." : String(count);
}

export function renderCounts(
  layout: Layout,
  counts: readonly number[],
): string[] {
  const mineKeys = new Set(layout.mines.map((m) => m.y * layout.width + m.x));
  const rows: string[] = [];
  for (let y = 0; y < layout.height; y++) {
    let row = "";
    for (let x = 0; x < layout.width; x++) {
      const i = y * layout.width + x;
      row += glyph(mineKeys.has(i), counts[i] ?? 0);
    }
    rows.push(row);
  }
  return rows;
}

export function renderBoard(snapshot: BoardSnapshot): string[] {
  const rows: string[] = [];
  for (let y = 0; y < snapshot.height; y++) {
    let row = "";
    for (let x = 0; x < snapshot.width; x++) {
      const cell = snapshot.cells[y * snapshot.width + x];
      row += cell === undefined ? "?" : glyph(cell.isMine, cell.adjMines);
    }
    rows.push(row);
  }
  return rows;
}
