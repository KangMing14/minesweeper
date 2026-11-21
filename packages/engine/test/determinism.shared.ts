// The determinism suite of M2-T06, written once and run twice: in Node (`determinism.node.test.ts`, part of
// `pnpm test`) and in Chromium (`determinism.browser.test.ts`, `pnpm test:browser`). Why shared: the claim of
// ADR-002 is that `(seed, config, commands)` gives the same game everywhere, and the only evidence for
// "everywhere" is one suite that does not know which environment it runs in.
//
// Every check runs twice: plain, and with `Date`, `Math.random`, `performance` and `Intl.DateTimeFormat` replaced
// by stubs that throw. Lint cannot see an alias (`const M = Math; M.random()`) or `globalThis['performance']`;
// a stub that throws turns any such read into a failing test (M0 review, L3).
//
// This file is not a `*.test.ts` file, so Vitest does not collect it on its own, and lint treats it as engine
// code: it may not name `Date`, `performance` or `Math.random`. The stubs are installed by name from strings in
// `determinism.support.ts`.
import { describe, expect, it } from 'vitest';
import boardsFixture from '../fixtures/boards.json' with { type: 'json' };
import prngFixture from '../fixtures/prng-vectors.json' with { type: 'json' };
import { SeededBoardGenerator, cellCount, createPrng } from '../src/index.js';
import type { FuzzOutcome } from './determinism.support.js';
import {
  FUZZ_GAMES,
  STUBBED_NAMES,
  hashInput,
  playFuzzGame,
  sha256Hex,
  withThrowingStubs,
} from './determinism.support.js';

/** Calls `next` `count` times and returns the results in order. */
const draw = (count: number, next: () => number): number[] => Array.from({ length: count }, next);

/** Reads a property of an object that TypeScript does not know, by name. */
const read = (target: unknown, key: string): unknown => Reflect.get(target as object, key);

/**
 * Defines the determinism suite inside the current Vitest file.
 *
 * @param environment - Where the suite runs (`node` or `browser`); it only appears in the test names.
 * @internal
 */
export function defineDeterminismSuite(environment: string): void {
  describe(`determinism (${environment})`, () => {
    describe('sha256Hex', () => {
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

    describe('the throwing stubs', () => {
      it('make every clock and random read fail, naming what was read', () => {
        const probes: Record<string, () => unknown> = {
          'new Date': () => new (read(globalThis, 'Date') as new () => unknown)(),
          'Date.now': () => (read(globalThis, 'Date') as { now(): number }).now(),
          'performance.now': () => (read(globalThis, 'performance') as { now(): number }).now(),
          'Math random': () => (read(Math, 'random') as () => number)(),
          'new Intl.DateTimeFormat': () =>
            new (read(Intl, 'DateTimeFormat') as new (locale: string) => unknown)('en'),
        };
        const messages = withThrowingStubs(() =>
          Object.entries(probes).map(([label, probe]) => {
            try {
              probe();
              return `${label}: did not throw`;
            } catch (error) {
              return `${label}: ${error instanceof Error ? error.message : String(error)}`;
            }
          }),
        );
        for (const message of messages) expect(message).toMatch(/: determinism stub: .+ was used$/);
        expect(messages).toHaveLength(Object.keys(probes).length);
      });

      it('name exactly the four globals of the M0 review', () => {
        expect([...STUBBED_NAMES].sort()).toEqual([
          'Date',
          'Intl.DateTimeFormat',
          'Math.random',
          'performance',
        ]);
      });

      it('put the originals back afterwards, also when the work throws', () => {
        const before = [
          Reflect.getOwnPropertyDescriptor(globalThis, 'Date'),
          Reflect.getOwnPropertyDescriptor(globalThis, 'performance'),
          Reflect.getOwnPropertyDescriptor(Math, 'random'),
          Reflect.getOwnPropertyDescriptor(Intl, 'DateTimeFormat'),
        ];
        expect(() =>
          withThrowingStubs(() => {
            throw new Error('work failed');
          }),
        ).toThrow('work failed');
        const after = [
          Reflect.getOwnPropertyDescriptor(globalThis, 'Date'),
          Reflect.getOwnPropertyDescriptor(globalThis, 'performance'),
          Reflect.getOwnPropertyDescriptor(Math, 'random'),
          Reflect.getOwnPropertyDescriptor(Intl, 'DateTimeFormat'),
        ];
        expect(after).toEqual(before);
        // The descriptors hold the very same function or accessor, not an equal copy.
        before.forEach((descriptor, i) => {
          expect(after[i]?.value).toBe(descriptor?.value);
          expect(after[i]?.get).toBe(descriptor?.get);
        });
      });

      it('refuse to nest, so an inner restore cannot leave the outer work unguarded', () => {
        expect(() => withThrowingStubs(() => withThrowingStubs(() => 1))).toThrow(/nest/);
      });
    });

    const modes = [
      { name: 'plain', run: <T>(work: () => T): T => work() },
      { name: 'with clock and random reads made fatal', run: withThrowingStubs },
    ] as const;

    for (const mode of modes) {
      describe(mode.name, () => {
        describe('golden boards (ADR-002)', () => {
          it.each(boardsFixture.boards)(
            '$name, seed $seed: opening and mine hash are the committed ones',
            (entry) => {
              const got = mode.run(() => {
                const { board, opening } = new SeededBoardGenerator().generate(
                  entry.config,
                  entry.seed,
                );
                const mines = Array.from({ length: cellCount(board.config) }, (_, i) => i).filter(
                  (i) => board.isMine(i),
                );
                return {
                  opening: [...opening],
                  mineCount: mines.length,
                  hash: sha256Hex(hashInput(mines)),
                };
              });
              expect(got.mineCount).toBe(entry.config.mineCount);
              expect(got.opening).toEqual(entry.opening);
              expect(got.hash).toBe(entry.minesSha256);
            },
          );

          it('hold at least 20 seeds and all three presets', () => {
            expect(boardsFixture.boards.length).toBeGreaterThanOrEqual(20);
            const names = new Set(boardsFixture.boards.map((entry) => entry.name));
            for (const preset of ['beginner', 'intermediate', 'expert']) {
              expect(names.has(preset)).toBe(true);
            }
          });
        });

        describe('PRNG golden vectors (ADR-002)', () => {
          it.each(prngFixture.vectors)(
            'seed $seed: nextUint32 and nextInt match the committed values',
            ({ seed, uint32, nextInt }) => {
              const got = mode.run(() => {
                const plain = createPrng(seed);
                const ints = Object.keys(nextInt).map((n) => {
                  const prng = createPrng(seed);
                  return [n, draw(20, () => prng.nextInt(Number(n)))] as const;
                });
                return { uint32: draw(20, () => plain.nextUint32()), ints };
              });
              expect(got.uint32).toEqual(uint32);
              expect(Object.fromEntries(got.ints)).toEqual(nextInt);
            },
          );
        });

        describe(`${String(FUZZ_GAMES)} fuzzed games`, () => {
          let cache: readonly FuzzOutcome[] | undefined;
          const outcomes = (): readonly FuzzOutcome[] => {
            cache ??= mode.run(() =>
              Array.from({ length: FUZZ_GAMES }, (_, index) => playFuzzGame(index)),
            );
            return cache;
          };

          it('end in the same view, result and log as their replay', () => {
            const all = outcomes();
            expect(all).toHaveLength(FUZZ_GAMES);
            all.forEach((outcome, index) => {
              // Compare as text first: 500 deep comparisons are slow, and a mismatch is then shown in full.
              if (JSON.stringify(outcome.replayed) !== JSON.stringify(outcome.live)) {
                expect(
                  outcome.replayed,
                  `game ${String(index)}, seed ${String(outcome.seed)}`,
                ).toStrictEqual(outcome.live);
              }
            });
          });

          // A fuzz run that only plays trivial games proves little. The games come from `createPrng`, so the
          // counts are the same in every environment and every run; these are floors, not expectations.
          it('reach wins by play, losses, unfinished games, chords and seeds above 2^31', () => {
            const all = outcomes();
            const count = (predicate: (outcome: FuzzOutcome) => boolean): number =>
              all.filter(predicate).length;
            // A win with no command at all is a board that the free opening cleared (M2-T03): it does not count.
            expect(
              count((o) => o.live.view.status === 'won' && o.live.log.length > 0),
            ).toBeGreaterThanOrEqual(30);
            expect(count((o) => o.live.view.status === 'lost')).toBeGreaterThanOrEqual(15);
            expect(
              count((o) => o.live.view.status === 'ready' || o.live.view.status === 'playing'),
            ).toBeGreaterThanOrEqual(15);
            expect(
              count((o) => o.live.log.some((command) => command.type === 'chord')),
            ).toBeGreaterThanOrEqual(40);
            expect(count((o) => o.seed > 2 ** 31)).toBeGreaterThanOrEqual(150);
            expect(new Set(all.map((o) => o.seed)).size).toBeGreaterThanOrEqual(FUZZ_GAMES - 2);
          });
        });
      });
    }
  });
}
