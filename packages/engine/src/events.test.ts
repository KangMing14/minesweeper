import { describe, expect, it } from 'vitest';
import { GameEventEmitter, type GameEvent } from './events.js';

const WON: GameEvent = { type: 'gameWon', t: 1200 };
const TOGGLED: GameEvent = { type: 'flagToggled', index: 4, flagged: true };

describe('GameEvent', () => {
  it('is a union a switch can cover completely, discriminated by `type`', () => {
    // If a variant is added or renamed without updating this switch, the `never` line stops compiling.
    function describeEvent(event: GameEvent): string {
      switch (event.type) {
        case 'cellsRevealed':
          return `revealed ${event.cells.map((cell) => `${cell.index}=${cell.value}`).join(',')}`;
        case 'flagToggled':
          return `flag ${event.index} ${String(event.flagged)}`;
        case 'gameWon':
          return `won at ${event.t}`;
        case 'gameLost':
          return `lost at ${event.t} on ${event.mineIndex}`;
        default: {
          const unreachable: never = event;
          return unreachable;
        }
      }
    }
    expect(describeEvent({ type: 'cellsRevealed', cells: [{ index: 3, value: 2 }] })).toBe(
      'revealed 3=2',
    );
    expect(describeEvent(TOGGLED)).toBe('flag 4 true');
    expect(describeEvent(WON)).toBe('won at 1200');
    expect(describeEvent({ type: 'gameLost', t: 50, mineIndex: 7 })).toBe('lost at 50 on 7');
  });
});

describe('GameEventEmitter', () => {
  it('delivers an event to every subscriber, in the order they subscribed', () => {
    const emitter = new GameEventEmitter();
    const calls: string[] = [];
    emitter.subscribe(() => calls.push('first'));
    emitter.subscribe(() => calls.push('second'));
    emitter.emit(WON);
    expect(calls).toEqual(['first', 'second']);
  });

  it('passes the event itself to the listener', () => {
    const emitter = new GameEventEmitter();
    const received: GameEvent[] = [];
    emitter.subscribe((event) => received.push(event));
    emitter.emit(TOGGLED);
    emitter.emit(WON);
    expect(received).toEqual([TOGGLED, WON]);
  });

  it('does nothing when nobody is subscribed', () => {
    expect(() => new GameEventEmitter().emit(WON)).not.toThrow();
  });

  it('stops delivery to a listener once it has unsubscribed', () => {
    const emitter = new GameEventEmitter();
    const received: GameEvent[] = [];
    const unsubscribe = emitter.subscribe((event) => received.push(event));
    emitter.emit(TOGGLED);
    unsubscribe();
    emitter.emit(WON);
    expect(received).toEqual([TOGGLED]);
  });

  it('keeps the other listeners when one unsubscribes', () => {
    const emitter = new GameEventEmitter();
    const calls: string[] = [];
    const unsubscribeA = emitter.subscribe(() => calls.push('a'));
    emitter.subscribe(() => calls.push('b'));
    unsubscribeA();
    emitter.emit(WON);
    expect(calls).toEqual(['b']);
  });

  it('treats calling unsubscribe twice as harmless, and never removes someone else', () => {
    const emitter = new GameEventEmitter();
    const calls: string[] = [];
    const listener = (): void => {
      calls.push('x');
    };
    const unsubscribeFirst = emitter.subscribe(listener);
    emitter.subscribe(listener);
    unsubscribeFirst();
    unsubscribeFirst();
    emitter.emit(WON);
    // The second registration of the same function is still there.
    expect(calls).toEqual(['x']);
  });

  it('registers the same function twice when it subscribes twice', () => {
    const emitter = new GameEventEmitter();
    let count = 0;
    const listener = (): void => {
      count++;
    };
    emitter.subscribe(listener);
    emitter.subscribe(listener);
    emitter.emit(WON);
    expect(count).toBe(2);
  });

  it('delivers the current event to the listeners present when it started, even if one unsubscribes another', () => {
    const emitter = new GameEventEmitter();
    const calls: string[] = [];
    let unsubscribeB = (): void => {};
    emitter.subscribe(() => {
      calls.push('a');
      unsubscribeB();
    });
    unsubscribeB = emitter.subscribe(() => calls.push('b'));
    emitter.emit(WON);
    expect(calls).toEqual(['a', 'b']);
    calls.length = 0;
    emitter.emit(WON);
    expect(calls).toEqual(['a']);
  });

  it('does not deliver the current event to a listener that subscribes while it is being delivered', () => {
    const emitter = new GameEventEmitter();
    const calls: string[] = [];
    emitter.subscribe(() => {
      calls.push('a');
      emitter.subscribe(() => calls.push('late'));
    });
    emitter.emit(WON);
    expect(calls).toEqual(['a']);
  });

  it('calls every listener even if one throws, then rethrows the first error', () => {
    const emitter = new GameEventEmitter();
    const calls: string[] = [];
    emitter.subscribe(() => {
      calls.push('a');
      throw new Error('first failure');
    });
    emitter.subscribe(() => calls.push('b'));
    emitter.subscribe(() => {
      calls.push('c');
      throw new Error('second failure');
    });
    expect(() => {
      emitter.emit(WON);
    }).toThrow('first failure');
    expect(calls).toEqual(['a', 'b', 'c']);
  });
});
