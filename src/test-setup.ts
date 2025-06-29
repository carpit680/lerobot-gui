import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend expect with testing library matchers
expect.extend(matchers);

// Declare global types for testing
declare global {
  namespace Vi {
    interface JestAssertion<T = any> extends matchers.TestingLibraryMatchers<T, void> {}
  }
}

afterEach(() => {
  cleanup();
}); 