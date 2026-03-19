import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { HybridMarkdownEditor } from '../HybridMarkdownEditor';

// Mock scrollIntoView as jsdom doesn't implement it
if (typeof window !== 'undefined' && window.HTMLElement) {
  window.HTMLElement.prototype.scrollIntoView = function() {};
}

describe('ReDoS Vulnerability Test', () => {
  it('should process a string with many asterisks without timing out', () => {
    // Generate a long string of asterisks
    const maliciousString = '*'.repeat(50000);

    // Start timing
    const startTime = performance.now();

    // Attempt to render the component with the string
    // This will hit the parseBold function when rendering lines
    const result = render(React.createElement(HybridMarkdownEditor, { value: maliciousString }));

    // End timing
    const endTime = performance.now();
    const duration = endTime - startTime;

    // We expect the render to be fast (e.g., under 1000ms),
    // a ReDoS would take multiple seconds or minutes.
    expect(duration).toBeLessThan(1000);
    expect(result.container).toBeDefined();
  });
});
