import { describe, it, expect } from 'vitest';
import { getMarkdownType, LineType } from './HybridMarkdownEditor';

describe('getMarkdownType', () => {
  it('should return h1 for single hash', () => {
    expect(getMarkdownType('# Heading 1')).toBe<LineType>('h1');
  });

  it('should return h2 for double hash', () => {
    expect(getMarkdownType('## Heading 2')).toBe<LineType>('h2');
  });

  it('should return h3 for triple hash', () => {
    expect(getMarkdownType('### Heading 3')).toBe<LineType>('h3');
  });

  it('should return h4 for quadruple hash', () => {
    expect(getMarkdownType('#### Heading 4')).toBe<LineType>('h4');
  });

  it('should return li for unordered list items', () => {
    expect(getMarkdownType('- List item')).toBe<LineType>('li');
    expect(getMarkdownType('* List item')).toBe<LineType>('li');
    expect(getMarkdownType('  - Indented list item')).toBe<LineType>('li');
  });

  it('should return li for ordered list items', () => {
    expect(getMarkdownType('1. List item')).toBe<LineType>('li');
    expect(getMarkdownType('  2. Indented ordered list item')).toBe<LineType>('li');
  });

  it('should return li for task list items', () => {
    expect(getMarkdownType('- [ ] Task')).toBe<LineType>('li');
    expect(getMarkdownType('- [x] Completed task')).toBe<LineType>('li');
    expect(getMarkdownType('- [X] Completed task')).toBe<LineType>('li');
  });

  it('should return blockquote for quote items', () => {
    expect(getMarkdownType('> Quote')).toBe<LineType>('blockquote');
    expect(getMarkdownType('  > Indented quote')).toBe<LineType>('blockquote');
  });

  it('should return p for normal text', () => {
    expect(getMarkdownType('Normal text')).toBe<LineType>('p');
    expect(getMarkdownType('Just some paragraph')).toBe<LineType>('p');
  });

  it('should handle edge cases and invalid formats gracefully', () => {
    // Missing space after hashes
    expect(getMarkdownType('#No space')).toBe<LineType>('p');
    expect(getMarkdownType('##No space')).toBe<LineType>('p');

    // Missing space after list markers
    expect(getMarkdownType('-No space')).toBe<LineType>('p');
    expect(getMarkdownType('1.No space')).toBe<LineType>('p');

    // Invalid task list formats
    expect(getMarkdownType('-[ ] No space')).toBe<LineType>('p');

    // Empty string
    expect(getMarkdownType('')).toBe<LineType>('p');
  });
});
