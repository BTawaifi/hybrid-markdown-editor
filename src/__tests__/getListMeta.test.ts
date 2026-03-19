import { getListMeta } from '../HybridMarkdownEditor';

describe('getListMeta', () => {
  describe('tasks', () => {
    it('should identify unchecked task lists', () => {
      const result = getListMeta('- [ ] Unchecked task');
      expect(result).toEqual({
        kind: 'task',
        indent: '',
        currentMarker: '- [ ] ',
        nextMarker: '- [ ] ',
      });
    });

    it('should identify checked task lists (lowercase x)', () => {
      const result = getListMeta('  * [x] Checked task');
      expect(result).toEqual({
        kind: 'task',
        indent: '  ',
        currentMarker: '  * [x] ',
        nextMarker: '  * [ ] ',
      });
    });

    it('should identify checked task lists (uppercase X)', () => {
      const result = getListMeta('    - [X] Checked task');
      expect(result).toEqual({
        kind: 'task',
        indent: '    ',
        currentMarker: '    - [x] ',
        nextMarker: '    - [ ] ',
      });
    });

    it('should identify task lists without a space before bracket', () => {
      // It expects a space before bracket, let's see what the actual function does
      // /^\s*[-*]\s\[[ xX]\]\s/ requires a space
      const result = getListMeta('-[ ] Invalid task');
      expect(result.kind).not.toBe('task');
    });
  });

  describe('unordered lists (ul)', () => {
    it('should identify unordered lists with -', () => {
      const result = getListMeta('- Unordered list item');
      expect(result).toEqual({
        kind: 'ul',
        indent: '',
        currentMarker: '- ',
        nextMarker: '- ',
      });
    });

    it('should identify unordered lists with * and indentation', () => {
      const result = getListMeta('  * Unordered list item');
      expect(result).toEqual({
        kind: 'ul',
        indent: '  ',
        currentMarker: '  * ',
        nextMarker: '  * ',
      });
    });
  });

  describe('ordered lists (ol)', () => {
    it('should identify ordered lists', () => {
      const result = getListMeta('1. Ordered list item');
      expect(result).toEqual({
        kind: 'ol',
        indent: '',
        currentMarker: '1. ',
        nextMarker: '2. ',
        number: 1,
      });
    });

    it('should identify ordered lists with indentation and larger numbers', () => {
      const result = getListMeta('    42. Ordered list item');
      expect(result).toEqual({
        kind: 'ol',
        indent: '    ',
        currentMarker: '    42. ',
        nextMarker: '    43. ',
        number: 42,
      });
    });
  });

  describe('blockquotes', () => {
    it('should identify blockquotes', () => {
      const result = getListMeta('> Blockquote text');
      expect(result).toEqual({
        kind: 'blockquote',
        indent: '',
        currentMarker: '> ',
        nextMarker: '> ',
      });
    });

    it('should identify blockquotes with indentation', () => {
      const result = getListMeta('  > Blockquote text');
      expect(result).toEqual({
        kind: 'blockquote',
        indent: '  ',
        currentMarker: '  > ',
        nextMarker: '  > ',
      });
    });
  });

  describe('no list / unknown', () => {
    it('should return null kind for normal text', () => {
      const result = getListMeta('Just some normal text');
      expect(result).toEqual({
        kind: null,
        indent: '',
        currentMarker: '',
        nextMarker: '',
      });
    });

    it('should return null kind for normal text with indentation', () => {
      const result = getListMeta('    Just some normal text');
      expect(result).toEqual({
        kind: null,
        indent: '    ',
        currentMarker: '',
        nextMarker: '',
      });
    });

    it('should return null kind for headers', () => {
      const result = getListMeta('### Header');
      expect(result).toEqual({
        kind: null,
        indent: '',
        currentMarker: '',
        nextMarker: '',
      });
    });
  });
});
