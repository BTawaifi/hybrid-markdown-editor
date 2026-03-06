import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { HybridMarkdownEditor } from './HybridMarkdownEditor';

describe('HybridMarkdownEditor', () => {
  it('renders correctly with initial value', () => {
    const value = '# Hello World\nThis is a test.';
    render(<HybridMarkdownEditor value={value} />);

    // Test that the h1 line renders correctly
    expect(screen.getByText('Hello World')).toBeInTheDocument();

    // Test that the paragraph line renders correctly
    expect(screen.getByText('This is a test.')).toBeInTheDocument();
  });

  it('calls onChange and onDebouncedChange when content is modified', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onDebouncedChange = vi.fn();

    render(
      <HybridMarkdownEditor
        value="Initial content"
        onChange={onChange}
        onDebouncedChange={onDebouncedChange}
        debounceMs={100}
      />
    );

    // Click the content to activate it (become a textarea)
    await user.click(screen.getByText('Initial content'));

    // The textarea should be visible now
    const textarea = screen.getByDisplayValue('Initial content');
    expect(textarea).toBeInTheDocument();

    // Type into the textarea
    await user.type(textarea, ' updated');

    // onChange should be called immediately
    expect(onChange).toHaveBeenCalledWith('Initial content updated');

    // Wait for debounce
    await waitFor(() => {
      expect(onDebouncedChange).toHaveBeenCalledWith('Initial content updated');
    });
  });

  it('updates when value prop changes', () => {
    const { rerender } = render(<HybridMarkdownEditor value="Old text" />);
    expect(screen.getByText('Old text')).toBeInTheDocument();

    rerender(<HybridMarkdownEditor value="New text" />);
    expect(screen.getByText('New text')).toBeInTheDocument();
  });
});
