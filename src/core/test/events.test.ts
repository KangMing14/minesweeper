import { describe, expectTypeOf, it } from "vitest";
import type { GameEvents, RevealedCell } from "../events";

describe("public-information rule", () => {
  it("revealed-cell payloads carry no isMine field", () => {
    expectTypeOf<RevealedCell>().not.toHaveProperty("isMine");
  });

  it("cellsRevealed carries RevealedCell entries", () => {
    expectTypeOf<
      GameEvents["cellsRevealed"]["cells"][number]
    >().toEqualTypeOf<RevealedCell>();
  });
});
