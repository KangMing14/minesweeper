import { describe, expect, it } from 'vitest';
import { InvalidBoardConfigError } from './errors.js';

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
