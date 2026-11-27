// Vitest setup for the `web` project (M3-T01). React Testing Library only cleans up after each test by itself
// when the test globals are on; this repository keeps them off, so the hook is registered here.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  // M3-T07. The app keeps statistics in localStorage; a test must not see the records of the one before it.
  // Some test files run in the node environment, which has no localStorage.
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
