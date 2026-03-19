import { describe, it, expect } from 'vitest';
import { mapDisplayOffsetToSourceIndex } from '../HybridMarkdownEditor';

describe('mapDisplayOffsetToSourceIndex', () => {
  it('handles plain text', () => {
    const text = 'hello world';
    expect(mapDisplayOffsetToSourceIndex(text, 0)).toBe(0); // 'h'
    expect(mapDisplayOffsetToSourceIndex(text, 5)).toBe(5); // ' '
    expect(mapDisplayOffsetToSourceIndex(text, 11)).toBe(11); // end
  });

  it('handles markdown prefixes (headings, lists, blockquotes)', () => {
    // Heading 1: prefix length 2 ("# ")
    expect(mapDisplayOffsetToSourceIndex('# Heading', 0)).toBe(2);
    expect(mapDisplayOffsetToSourceIndex('# Heading', 7)).toBe(9); // end

    // Task list: prefix length 6 ("- [ ] ")
    expect(mapDisplayOffsetToSourceIndex('- [ ] Task', 0)).toBe(6);
    expect(mapDisplayOffsetToSourceIndex('- [ ] Task', 4)).toBe(10); // end

    // Completed task list: prefix length 6 ("- [x] ")
    expect(mapDisplayOffsetToSourceIndex('- [x] Task', 0)).toBe(6);

    // Unordered list: prefix length 2 ("- ")
    expect(mapDisplayOffsetToSourceIndex('- List', 0)).toBe(2);

    // Ordered list: prefix length 3 ("1. ")
    expect(mapDisplayOffsetToSourceIndex('1. List', 0)).toBe(3);

    // Blockquote: prefix length 2 ("> ")
    expect(mapDisplayOffsetToSourceIndex('> Quote', 0)).toBe(2);
  });

  it('handles inline bold markers (**)', () => {
    // "**Bold**" -> display "Bold"
    expect(mapDisplayOffsetToSourceIndex('**Bold**', 0)).toBe(2); // 'B'
    expect(mapDisplayOffsetToSourceIndex('**Bold**', 1)).toBe(3); // 'o'
    expect(mapDisplayOffsetToSourceIndex('**Bold**', 2)).toBe(4); // 'l'
    expect(mapDisplayOffsetToSourceIndex('**Bold**', 3)).toBe(5); // 'd'
    // after "d", displayCount is 4. The loop will hit the "**" and skip it.
    // actually, let's trace:
    // displayCount=4, displayOffset=4 -> it should return 8
    expect(mapDisplayOffsetToSourceIndex('**Bold**', 4)).toBe(8);

    // "Text **bold** text"
    // d=0..4 -> 0..4
    // d=5 -> "b" (source 7)
    // d=6 -> "o" (source 8)
    // d=7 -> "l" (source 9)
    // d=8 -> "d" (source 10)
    // d=9 -> " " (source 13)
    const mixed = 'Text **bold** text';
    expect(mapDisplayOffsetToSourceIndex(mixed, 0)).toBe(0);
    expect(mapDisplayOffsetToSourceIndex(mixed, 4)).toBe(4); // space before **
    expect(mapDisplayOffsetToSourceIndex(mixed, 5)).toBe(7); // 'b'
    expect(mapDisplayOffsetToSourceIndex(mixed, 9)).toBe(13); // space after **
  });

  it('handles combined prefixes and inline markers', () => {
    // "# **Bold** Heading" -> prefix "# " (2). Display: "Bold Heading"
    // source: '# **Bold** Heading'
    // d=0 -> 'B' (source 4)
    // d=4 -> ' ' (source 10)
    const combined = '# **Bold** Heading';
    expect(mapDisplayOffsetToSourceIndex(combined, 0)).toBe(4);
    expect(mapDisplayOffsetToSourceIndex(combined, 4)).toBe(10); // space
    expect(mapDisplayOffsetToSourceIndex(combined, 5)).toBe(11); // 'H'
  });

  it('handles edge cases and out-of-bounds offsets', () => {
    // Empty line
    expect(mapDisplayOffsetToSourceIndex('', 0)).toBe(0);
    expect(mapDisplayOffsetToSourceIndex('', 5)).toBe(0);

    // Offset larger than display text
    expect(mapDisplayOffsetToSourceIndex('hello', 10)).toBe(5);
    expect(mapDisplayOffsetToSourceIndex('# hello', 10)).toBe(7);
    expect(mapDisplayOffsetToSourceIndex('**hello**', 10)).toBe(9);
  });
});
