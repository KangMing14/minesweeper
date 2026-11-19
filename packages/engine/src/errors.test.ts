import { describe, expect, it } from 'vitest';
import { InvalidBoardConfigError, InvalidReplayError } from './errors.js';

describe('InvalidBoardConfigError', () => {
  it('is an Error, so callers can catch it generically', () => {
    const error = new InvalidBoardConfigError('width must be positive');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(InvalidBoardConfigError);
  });

  it('carries the reason and uses it as the message', () => {
    const error = new InvalidBoardConfigError('width must be positive');
    expect(error.reason).toBe('width must be positive');
    expect(error.message).toBe('width must be positive');
  });

  it('has a stable name that survives logging and serialization', () => {
    expect(new InvalidBoardConfigError('x').name).toBe('InvalidBoardConfigError');
  });

  it('keeps a stack trace', () => {
    expect(new InvalidBoardConfigError('x').stack).toContain('InvalidBoardConfigError');
  });
});

describe('InvalidReplayError', () => {
  it('is an Error, and not an InvalidBoardConfigError, so callers can tell the two apart', () => {
    const error = new InvalidReplayError('seed must be an integer');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(InvalidReplayError);
    expect(error).not.toBeInstanceOf(InvalidBoardConfigError);
  });

  it('carries the reason and uses it as the message', () => {
    const error = new InvalidReplayError('seed must be an integer');
    expect(error.reason).toBe('seed must be an integer');
    expect(error.message).toBe('seed must be an integer');
  });

  it('has a stable name that survives logging and serialization', () => {
    expect(new InvalidReplayError('x').name).toBe('InvalidReplayError');
  });

  it('keeps a stack trace', () => {
    expect(new InvalidReplayError('x').stack).toContain('InvalidReplayError');
  });

  it('keeps the error that caused it, when there is one', () => {
    const cause = new InvalidBoardConfigError('width must be positive');
    expect(new InvalidReplayError('config is not valid', { cause }).cause).toBe(cause);
  });

  it('has no cause when none is given', () => {
    expect('cause' in new InvalidReplayError('x')).toBe(false);
  });
});
