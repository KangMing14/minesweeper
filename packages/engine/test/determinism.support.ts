// Helpers of the determinism suite (M2-T06): a SHA-256, throwing stubs for every global that could make a game
// depend on the environment, and a fuzz player whose games are derived from `createPrng` alone, so the same
// 500 games are played in Node and in a browser. Test support only: nothing here is part of the public API.
import type { BoardConfig, CellIndex, Command, GameResult, GameView } from '../src/index.js';
import { PRESETS, createGame, createPrng, replay } from '../src/index.js';
import type { ReplayLog } from '../src/index.js';

// Why a hand-written SHA-256 here: engine code, tests included, may not import `node:*` (lint), the Web Crypto
// API is asynchronous and untyped here (no DOM lib), and the same hash must run in a real browser. It only keeps
// the golden fixture small. It is checked against the published test vectors in `determinism.shared.ts`, and the
// fixture's hashes were also computed with Node's `crypto` when the fixture was written (see its `generatedBy`).
// It moved here from `generator.golden.test.ts` in M2-T06.
const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const INITIAL_HASH = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

/** Element `index` of a list of words; the lists here are always long enough, so a miss is a bug. */
const word = (words: ArrayLike<number>, index: number): number => {
  const value = words[index];
  if (value === undefined) throw new Error(`no word at ${String(index)}`);
  return value;
};

const rotateRight = (value: number, bits: number): number =>
  (value >>> bits) | (value << (32 - bits));

/**
 * SHA-256 of an ASCII string, as 64 lower-case hex digits.
 *
 * @param text - ASCII text; anything else throws.
 * @internal
 */
export function sha256Hex(text: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) throw new Error('sha256Hex takes ASCII only');
    bytes.push(code);
  }
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 2 ** 32);
  const low = bitLength >>> 0;
  for (const part of [high, low]) {
    bytes.push((part >>> 24) & 0xff, (part >>> 16) & 0xff, (part >>> 8) & 0xff, part & 0xff);
  }

  const hash = Uint32Array.from(INITIAL_HASH);
  const schedule = new Uint32Array(64);
  for (let block = 0; block < bytes.length; block += 64) {
    for (let i = 0; i < 16; i += 1) {
      const at = block + i * 4;
      schedule[i] =
        (word(bytes, at) << 24) |
        (word(bytes, at + 1) << 16) |
        (word(bytes, at + 2) << 8) |
        word(bytes, at + 3);
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = word(schedule, i - 15);
      const w2 = word(schedule, i - 2);
      const s0 = rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3);
      const s1 = rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10);
      schedule[i] = word(schedule, i - 16) + s0 + word(schedule, i - 7) + s1;
    }
    let [a, b, c, d, e, f, g, h] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => word(hash, i)) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let i = 0; i < 64; i += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + word(ROUND_CONSTANTS, i) + word(schedule, i)) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((value, i) => {
      hash[i] = word(hash, i) + value;
    });
  }
  return Array.from(hash, (value) => value.toString(16).padStart(8, '0')).join('');
}

/**
 * The text that the golden fixture hashes: the mine indices in ascending order, joined by commas.
 *
 * @param mines - Mine indices in ascending order.
 * @internal
 */
export const hashInput = (mines: readonly CellIndex[]): string => mines.join(',');

/**
 * The globals that the stubs replace, spelled the way a reader would search for them.
 *
 * @internal
 */
export const STUBBED_NAMES: readonly string[] = [
  'Date',
  'Intl.DateTimeFormat',
  'Math.random',
  'performance',
];

/** One global that the stubs replace: the object that owns the property, and the property's name. */
interface StubTarget {
  readonly owner: object;
  readonly key: string;
}

// Names are strings on purpose. Lint bans the identifiers `Date`, `performance` and `Math.random` in engine
// files, which is right for engine code; here the point is to replace exactly those, and a string is not a read.
const TARGETS: readonly StubTarget[] = [
  { owner: globalThis, key: 'Date' },
  { owner: globalThis, key: 'performance' },
  { owner: Math, key: 'random' },
  { owner: Intl, key: 'DateTimeFormat' },
];

let stubsInstalled = false;

/**
 * Runs `work` with `Date`, `performance`, `Math.random` and `Intl.DateTimeFormat` replaced by stubs that throw
 * on any use (call, construction or property read), then puts the originals back, even if `work` throws.
 *
 * @remarks
 * `work` must be synchronous and must not assert: the test runner itself reads clocks, and it does so
 * outside this window. Return plain data and assert afterwards. A stub that cannot be installed (a read-only
 * property in some environment) is an error, never a silent skip, so a green run always means the stubs were live.
 *
 * @param work - The synchronous code to run.
 * @returns What `work` returned.
 * @throws Error if called inside another call of itself, or if a stub cannot be installed.
 * @internal
 */
export function withThrowingStubs<T>(work: () => T): T {
  if (stubsInstalled) throw new Error('withThrowingStubs cannot nest');
  const saved: { target: StubTarget; descriptor: PropertyDescriptor }[] = [];
  stubsInstalled = true;
  try {
    for (const target of TARGETS) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target.owner, target.key);
      if (descriptor === undefined) throw new Error(`no own property ${target.key} to stub`);
      const label =
        target.owner === Math
          ? `Math.${target.key}`
          : target.owner === Intl
            ? `Intl.${target.key}`
            : target.key;
      const fail = (): never => {
        throw new Error(`determinism stub: ${label} was used`);
      };
      const stub = new Proxy(function stubbed() {}, {
        apply: fail,
        construct: fail,
        get: fail,
        has: fail,
      });
      const installed = Reflect.defineProperty(target.owner, target.key, {
        configurable: true,
        enumerable: descriptor.enumerable ?? false,
        writable: true,
        value: stub,
      });
      if (!installed) throw new Error(`could not stub ${label}`);
      saved.push({ target, descriptor });
    }
    return work();
  } finally {
    for (const { target, descriptor } of saved.reverse()) {
      Reflect.defineProperty(target.owner, target.key, descriptor);
    }
    stubsInstalled = false;
  }
}

/**
 * How many games the fuzz suite plays; the task asks for 500.
 *
 * @internal
 */
export const FUZZ_GAMES = 500;

/**
 * What is compared between a game and its replay: the final view, the result record and the command log.
 *
 * @internal
 */
export interface GameSnapshot {
  readonly view: GameView;
  readonly result: GameResult | undefined;
  readonly log: readonly Command[];
}

/**
 * A fuzzed game, played live, and the same game rebuilt by `replay` from its log after a trip through JSON.
 *
 * @internal
 */
export interface FuzzOutcome {
  readonly config: BoardConfig;
  readonly seed: number;
  readonly live: GameSnapshot;
  readonly replayed: GameSnapshot;
}

// Board sizes of the fuzz games. Small boards finish and are won in a few dozen commands; the presets are there
// for their size (a cascade of hundreds of cells) and are rarer because they cost more to play.
const FUZZ_CONFIGS: readonly BoardConfig[] = [
  { width: 3, height: 3, mineCount: 1 },
  { width: 5, height: 5, mineCount: 3 },
  { width: 5, height: 5, mineCount: 3 },
  { width: 8, height: 8, mineCount: 10 },
  { width: 8, height: 8, mineCount: 10 },
  { width: 12, height: 7, mineCount: 12 },
  { width: 10, height: 1, mineCount: 2 },
  { width: 1, height: 10, mineCount: 2 },
  PRESETS.beginner,
  PRESETS.beginner,
  PRESETS.intermediate,
  PRESETS.expert,
];

/** The up to 8 cells that touch `index`, in ascending order (the view has no board, so the player works it out). */
function neighborsOf(index: CellIndex, width: number, height: number): CellIndex[] {
  const x = index % width;
  const y = Math.floor(index / width);
  const result: CellIndex[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx !== 0 || dy !== 0) && nx >= 0 && nx < width && ny >= 0 && ny < height) {
        result.push(ny * width + nx);
      }
    }
  }
  return result;
}

/** A command the fuzz player may send: its type and cell, before a time is stamped on it. */
interface Pick {
  readonly type: Command['type'];
  readonly index: CellIndex;
}

/**
 * Chooses the next command from the view alone, the way a client would. Mostly it plays like a careful player
 * (chord a satisfied number, flag cells that must be mines, otherwise open a hidden cell); sometimes it plays
 * badly (a random flag that may be wrong, a chord on any cell, a wrong flag that makes a later chord lose).
 */
function choose(view: GameView, prng: ReturnType<typeof createPrng>): Pick {
  const { width, height, cells } = view;
  const total = cells.length;
  const anyCell = (): CellIndex => prng.nextInt(total);
  const hiddenUnflagged: CellIndex[] = [];
  cells.forEach((cell, index) => {
    if (cell.state === 'hidden') hiddenUnflagged.push(index);
  });
  const roll = prng.nextInt(100);

  if (roll < 60) {
    const chords: CellIndex[] = [];
    const forcedFlags: CellIndex[] = [];
    cells.forEach((cell, index) => {
      if (cell.state !== 'revealed' || cell.value === 0) return;
      const around = neighborsOf(index, width, height).map((n) => ({ n, cell: cells[n] }));
      const flagged = around.filter((a) => a.cell?.state === 'flagged').length;
      const hidden = around.filter((a) => a.cell?.state === 'hidden');
      if (flagged === cell.value && hidden.length > 0) chords.push(index);
      // Every closed neighbor must be a mine when as many are closed as the number says.
      if (hidden.length > 0 && hidden.length + flagged === cell.value) {
        for (const a of hidden) forcedFlags.push(a.n);
      }
    });
    if (chords.length > 0)
      return { type: 'chord', index: chords[prng.nextInt(chords.length)] ?? 0 };
    if (forcedFlags.length > 0) {
      return { type: 'flag', index: forcedFlags[prng.nextInt(forcedFlags.length)] ?? 0 };
    }
  }
  if (roll < 88 && hiddenUnflagged.length > 0) {
    return { type: 'reveal', index: hiddenUnflagged[prng.nextInt(hiddenUnflagged.length)] ?? 0 };
  }
  if (roll < 94) return { type: 'flag', index: anyCell() };
  if (roll < 98) return { type: 'chord', index: anyCell() };
  return { type: 'reveal', index: anyCell() };
}

/** Everything that is compared between two games. */
function snapshot(game: ReturnType<typeof createGame>): GameSnapshot {
  return { view: game.view(), result: game.result(), log: game.log() };
}

/**
 * Plays fuzzed game number `index` and replays its log.
 *
 * @remarks
 * Every choice comes from `createPrng`, seeded by the index, so game `n` is the same game in every environment
 * and every run. The player sends the occasional command with a stale `t`, which the engine must reject and
 * keep out of the log. The log goes through JSON before it is replayed, because that is how a stored log
 * arrives.
 *
 * @param index - The game number, from 0.
 * @returns The live end state and the replayed one, as plain data.
 * @internal
 */
export function playFuzzGame(index: number): FuzzOutcome {
  const prng = createPrng(Math.imul(index + 1, 0x9e3779b1) >>> 0);
  const config = FUZZ_CONFIGS[prng.nextInt(FUZZ_CONFIGS.length)] ?? PRESETS.beginner;
  // The full uint32 range, so seeds above 2^31 (where a signed 32-bit slip shows up) are played too.
  const seed = prng.nextUint32();
  const game = createGame(config, seed);
  // One game in four is cut short, so the sample holds unfinished games as well as won and lost ones.
  const maxCommands = prng.nextInt(4) === 0 ? 2 + prng.nextInt(20) : 30 + prng.nextInt(170);

  let t = 0;
  for (
    let step = 0;
    step < maxCommands && game.view().status !== 'won' && game.view().status !== 'lost';
    step += 1
  ) {
    const pick = choose(game.view(), prng);
    const stale = t > 0 && prng.nextInt(100) < 3;
    t += prng.nextInt(30);
    game.apply({ ...pick, t: stale ? t - 1 - prng.nextInt(t) : t });
  }

  const log: ReplayLog = { version: 1, config, seed, commands: game.log() };
  const replayed = replay(JSON.parse(JSON.stringify(log)) as ReplayLog);
  return { config, seed, live: snapshot(game), replayed: snapshot(replayed) };
}
