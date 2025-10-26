import React from 'react';
import { describe, it, expect } from 'vitest';
import { parseBold } from '../HybridMarkdownEditor';

describe('parseBold', () => {
  it('returns array with a single string for plain text', () => {
    const result = parseBold('hello world');
    expect(result).toEqual(['hello world']);
  });

  it('parses fully bolded string into a React strong element', () => {
    const result = parseBold('**hello**');
    // BOLD_REGEX match splits it into ["", "**hello**", ""]
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('');
    expect(React.isValidElement(result[1])).toBe(true);
    expect((result[1] as React.ReactElement).type).toBe('strong');
    expect((result[1] as React.ReactElement).props.children).toBe('hello');
    expect(result[2]).toBe('');
  });

  it('parses text with bolded substring correctly', () => {
    const result = parseBold('this is **bold** text');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('this is ');
    expect(React.isValidElement(result[1])).toBe(true);
    expect((result[1] as React.ReactElement).type).toBe('strong');
    expect((result[1] as React.ReactElement).props.children).toBe('bold');
    expect(result[2]).toBe(' text');
  });

  it('handles multiple bold sections in a string', () => {
    const result = parseBold('**one** and **two**');
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('');
    expect((result[1] as React.ReactElement).props.children).toBe('one');
    expect(result[2]).toBe(' and ');
    expect((result[3] as React.ReactElement).props.children).toBe('two');
    expect(result[4]).toBe('');
  });

  it('handles empty bold syntax (four asterisks)', () => {
    const result = parseBold('****');
    // Since '****' doesn't match BOLD_REGEX (which requires non-asterisk characters),
    // it returns an array of length 1 containing a strong element.
    expect(result).toHaveLength(1);
    expect(React.isValidElement(result[0])).toBe(true);
    expect((result[0] as React.ReactElement).type).toBe('strong');
    expect((result[0] as React.ReactElement).props.children).toBe('');
  });

  it('leaves incomplete bold syntax unchanged (unmatched asterisks)', () => {
    const result = parseBold('**hello');
    expect(result).toEqual(['**hello']);
  });

  it('does not match single asterisks as bold', () => {
    const result = parseBold('*hello*');
    expect(result).toEqual(['*hello*']);
  });
});
