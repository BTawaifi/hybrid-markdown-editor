import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getClickDisplayOffset } from './HybridMarkdownEditor';

describe('getClickDisplayOffset', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    // Default rect width: 100, left: 10, right: 110
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      left: 10,
      right: 110,
      top: 0,
      bottom: 0,
      height: 0,
      x: 10,
      y: 0,
      toJSON: () => {}
    });
    Object.defineProperty(container, 'textContent', {
      value: 'hello',
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // clear document mocks
    (document as any).caretRangeFromPoint = undefined;
    (document as any).caretPositionFromPoint = undefined;
    if (document.createRange) {
      vi.mocked(document.createRange)?.mockRestore?.();
    }
  });

  it('handles caretRangeFromPoint throwing an error and falls back to coordinate estimation', () => {
    (document as any).caretRangeFromPoint = vi.fn().mockImplementation(() => {
      throw new Error('caretRangeFromPoint error');
    });

    // click at x=60 (middle of 100 width rect, so ratio is 0.5)
    // text length is 5 ("hello"). 0.5 * 5 = 2.5 => round to 3
    const result = getClickDisplayOffset(container, 60, 0);

    expect(result).toBe(3);
    expect((document as any).caretRangeFromPoint).toHaveBeenCalled();
  });

  it('handles caretPositionFromPoint throwing an error and falls back to coordinate estimation', () => {
    (document as any).caretPositionFromPoint = vi.fn().mockImplementation(() => {
      throw new Error('caretPositionFromPoint error');
    });

    // click at x=30 (20/100 = 0.2 ratio)
    // 0.2 * 5 = 1 => round to 1
    const result = getClickDisplayOffset(container, 30, 0);

    expect(result).toBe(1);
    expect((document as any).caretPositionFromPoint).toHaveBeenCalled();
  });

  it('handles empty text content during fallback estimation', () => {
    (document as any).caretRangeFromPoint = vi.fn().mockImplementation(() => {
      throw new Error('error');
    });

    Object.defineProperty(container, 'textContent', { value: '' });

    const result = getClickDisplayOffset(container, 50, 0);
    expect(result).toBe(0);
  });

  it('handles bounding rect width <= 1 during fallback estimation', () => {
    (document as any).caretRangeFromPoint = vi.fn().mockImplementation(() => {
      throw new Error('error');
    });

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      width: 1, left: 10, right: 11, top: 0, bottom: 0, height: 0, x: 10, y: 0, toJSON: () => {}
    });

    const result = getClickDisplayOffset(container, 10, 0);
    expect(result).toBe(5); // Should return textLen which is 5
  });

  it('handles click outside left edge during fallback estimation', () => {
    (document as any).caretRangeFromPoint = vi.fn().mockImplementation(() => {
      throw new Error('error');
    });

    const result = getClickDisplayOffset(container, 5, 0); // left is 10, 5 <= 10 + 4
    expect(result).toBe(0);
  });

  it('handles click outside right edge during fallback estimation', () => {
    (document as any).caretRangeFromPoint = vi.fn().mockImplementation(() => {
      throw new Error('error');
    });

    const result = getClickDisplayOffset(container, 115, 0); // right is 110, 115 >= 110 - 4
    expect(result).toBe(5);
  });

  it('handles document.createRange() throwing an error when caretNode is present', () => {
    const textNode = document.createTextNode('test');

    // Mock caretPositionFromPoint to return successfully
    (document as any).caretPositionFromPoint = vi.fn().mockReturnValue({
      offsetNode: textNode,
      offset: 2
    });

    // Mock document.createRange to throw an error during selection/toString
    const mockRange = {
      selectNodeContents: vi.fn(),
      setEnd: vi.fn(),
      toString: vi.fn().mockImplementation(() => {
        throw new Error('range error');
      })
    };

    vi.spyOn(document, 'createRange').mockReturnValue(mockRange as unknown as Range);

    // click at x=80 (70/100 = 0.7 ratio)
    // 0.7 * 5 = 3.5 => round to 4
    const result = getClickDisplayOffset(container, 80, 0);

    expect(result).toBe(4);
    expect(document.createRange).toHaveBeenCalled();
  });
});
