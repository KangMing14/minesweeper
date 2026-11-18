import { describe, expect, it } from 'vitest';
import golden from '../fixtures/boards.json' with { type: 'json' };
import type { CellIndex } from './config.js';
import { cellCount } from './config.js';
import { SeededBoardGenerator } from './generator.js';

// Why a hand-written SHA-256 in a test file: engine code, tests included, may not import `node:*` (lint), the
// Web Crypto API is asynchronous and untyped here (no DOM lib), and M2-T06 runs the same checks in a real
// browser. The hash is only used to keep the fixture small. The implementation is checked against the
// published test vectors below, and the fixture's hashes were also computed with Node's `crypto` when the
// file was written (see `generatedBy` in the fixture).
// TODO(M2-T06): move `sha256Hex` into the shared determinism test module when that task creates it.
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

/** SHA-256 of an ASCII string, as 64 lower-case hex digits. */
function sha256Hex(text: string): string {
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

/** The text that the fixture hashes: the mine indices in ascending order, joined by commas. */
const hashInput = (mines: readonly CellIndex[]): string => mines.join(',');

describe('sha256Hex (the helper of this file)', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
    ['a'.repeat(1000), '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3'],
  ])('matches the published vector for %j', (input, expected) => {
    expect(sha256Hex(input)).toBe(expected);
  });
});

// The board that a seed gives is a stable contract (ADR-002): stored replays, ghosts and shared races rebuild
// the board from `(config, seed)`. These entries pin 22 boards. A failure here means that the layout or the
// opening for an existing seed changed. Do not update the fixture to make it pass: a change needs a new
// generator version and an ADR (see DECISIONS.md, "Generator stability").
describe('SeededBoardGenerator: golden boards', () => {
  const generator = new SeededBoardGenerator();

  it.each(golden.boards)(
    '$name, seed $seed: opening and mine hash are the committed ones',
    (entry) => {
      const { board, opening } = generator.generate(entry.config, entry.seed);
      const mines = Array.from({ length: cellCount(board.config) }, (_, index) => index).filter(
        (index) => board.isMine(index),
      );
      expect(mines).toHaveLength(entry.config.mineCount);
      expect(opening).toEqual(entry.opening);
      expect(sha256Hex(hashInput(mines))).toBe(entry.minesSha256);
    },
  );

  it('covers the three presets with several seeds each, and the extreme boards', () => {
    const names = new Set(golden.boards.map((entry) => entry.name));
    for (const name of ['beginner', 'intermediate', 'expert']) expect(names.has(name)).toBe(true);
    expect(golden.boards.length).toBeGreaterThanOrEqual(20);
    for (const preset of ['beginner', 'intermediate', 'expert']) {
      const seeds = golden.boards
        .filter((entry) => entry.name === preset)
        .map((entry) => entry.seed);
      expect(new Set(seeds).size).toBeGreaterThanOrEqual(6);
    }
    expect(golden.hashInput).toBe('ascending mine indices joined by a comma');
  });
});
