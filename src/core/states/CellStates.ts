import type { CellState } from "../types";

export interface CellStateBehavior {
  readonly name: CellState;
  reveal(): CellStateBehavior;
  toggleFlag(): CellStateBehavior;
}

class HiddenState implements CellStateBehavior {
  readonly name: CellState = "hidden";
  reveal(): CellStateBehavior {
    return REVEALED;
  }
  toggleFlag(): CellStateBehavior {
    return FLAGGED;
  }
}

class FlaggedState implements CellStateBehavior {
  readonly name: CellState = "flagged";
  reveal(): CellStateBehavior {
    return this;
  }
  toggleFlag(): CellStateBehavior {
    return HIDDEN;
  }
}

class RevealedState implements CellStateBehavior {
  readonly name: CellState = "revealed";
  reveal(): CellStateBehavior {
    return this;
  }
  toggleFlag(): CellStateBehavior {
    return this;
  }
}

export const HIDDEN: CellStateBehavior = new HiddenState();
export const FLAGGED: CellStateBehavior = new FlaggedState();
export const REVEALED: CellStateBehavior = new RevealedState();

const BY_NAME: Record<CellState, CellStateBehavior> = {
  hidden: HIDDEN,
  flagged: FLAGGED,
  revealed: REVEALED,
};

export function cellStateFromName(name: string): CellStateBehavior {
  if (!Object.hasOwn(BY_NAME, name)) {
    throw new Error(`Unknown cell state "${name}"`);
  }
  return BY_NAME[name as CellState];
}
