import React from 'react';
import { describe, it, expect } from 'vitest';
import { parseBold } from '../HybridMarkdownEditor';

type ElementWithChildren = React.ReactElement<{ children?: React.ReactNode }>;

const childrenOf = (value: string | React.ReactElement) =>
  (value as ElementWithChildren).props.children;

describe('parseBold', () => {
  it('returns array with a single string for plain text', () => {
    expect(parseBold('hello world')).toEqual(['hello world']);
  });

  it('parses fully bolded string into a React strong element', () => {
    const result = parseBold('**hello**');
    expect(result).toHaveLength(1);
    expect(React.isValidElement(result[0])).toBe(true);
    expect((result[0] as React.ReactElement).type).toBe('strong');
    expect(childrenOf(result[0])).toBe('hello');
  });

  it('parses text with a bolded substring correctly', () => {
    const result = parseBold('this is **bold** text');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('this is ');
    expect(React.isValidElement(result[1])).toBe(true);
    expect(childrenOf(result[1])).toBe('bold');
    expect(result[2]).toBe(' text');
  });

  it('handles multiple bold sections in a string', () => {
    const result = parseBold('**one** and **two**');
    expect(result).toHaveLength(3);
    expect(childrenOf(result[0])).toBe('one');
    expect(result[1]).toBe(' and ');
    expect(childrenOf(result[2])).toBe('two');
  });

  it('keeps empty bold syntax literal', () => {
    expect(parseBold('****')).toEqual(['****']);
  });

  it('leaves incomplete bold syntax unchanged', () => {
    expect(parseBold('**hello')).toEqual(['**hello']);
    expect(parseBold('hello**')).toEqual(['hello**']);
  });

  it('does not match single asterisks as bold', () => {
    expect(parseBold('*hello*')).toEqual(['*hello*']);
  });

  it('does not greedily cross embedded asterisks', () => {
    expect(parseBold('**a*b**')).toEqual(['**a*b**']);
  });
});
