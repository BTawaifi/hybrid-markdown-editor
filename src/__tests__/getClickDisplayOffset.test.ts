import { describe, it, expect, vi } from 'vitest';
import { getClickDisplayOffset } from '../HybridMarkdownEditor';

describe('getClickDisplayOffset', () => {
  it('should return text length if no caret node is found and rect width is <= 1', () => {
    const container = document.createElement('div');
    container.textContent = 'Hello, World!';

    // Mock getBoundingClientRect
    container.getBoundingClientRect = vi.fn(() => ({
      width: 1,
      left: 0,
      right: 1,
      top: 0,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {}
    }));

    const result = getClickDisplayOffset(container, 10, 10);
    expect(result).toBe(13); // 'Hello, World!'.length
  });

  it('should return 0 if clientX <= rect.left + 4 when no caret node is found', () => {
    const container = document.createElement('div');
    container.textContent = 'Hello, World!';

    // Mock getBoundingClientRect
    container.getBoundingClientRect = vi.fn(() => ({
      width: 100,
      left: 10,
      right: 110,
      top: 0,
      bottom: 0,
      height: 0,
      x: 10,
      y: 0,
      toJSON: () => {}
    }));

    // clientX = 14 <= rect.left (10) + 4
    const result = getClickDisplayOffset(container, 14, 10);
    expect(result).toBe(0);
  });

  it('should handle range error, catch it, and fallback to coordinates logic', () => {
    const container = document.createElement('div');
    container.textContent = 'Testing the catch block';

    // Mock getBoundingClientRect for the fallback logic
    container.getBoundingClientRect = vi.fn(() => ({
      width: 100,
      left: 10,
      right: 110,
      top: 0,
      bottom: 0,
      height: 0,
      x: 10,
      y: 0,
      toJSON: () => {}
    }));

    // Setup dummy caretNode that bypasses the first `!caretNode` block
    const mockCaretPositionFromPoint = vi.fn(() => ({
      offsetNode: document.createTextNode('test'),
      offset: 2
    }));

    // Typecast to avoid ts errors, or just attach to document
    (document as any).caretPositionFromPoint = mockCaretPositionFromPoint;

    // Mock document.createRange to throw an error, hitting the catch block
    document.createRange = vi.fn(() => {
      throw new Error('Range creation failed');
    });

    // We test the fallback. If clientX <= rect.left + 4, it should return 0.
    // clientX = 10 <= 10 + 4
    let result = getClickDisplayOffset(container, 10, 10);
    expect(result).toBe(0);

    // If clientX >= rect.right - 4, it should return text length
    // rect.right = 110. clientX = 106 >= 110 - 4
    result = getClickDisplayOffset(container, 106, 10);
    expect(result).toBe(container.textContent?.length);

    // Test intermediate ratio: clientX = 60. Ratio = (60 - 10) / 100 = 0.5
    // Length is 23. Math.round(0.5 * 23) = 12
    result = getClickDisplayOffset(container, 60, 10);
    expect(result).toBe(12);
  });
});
