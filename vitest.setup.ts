import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are disabled, so Testing Library cannot register its automatic
// cleanup hook. Make test isolation explicit for every render-based test.
afterEach(() => {
  cleanup();
});

// jsdom does not implement scrollIntoView, but the editor intentionally uses it on activation.
Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  writable: true,
  value: function scrollIntoView() {},
});
