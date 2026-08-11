# Hybrid Markdown Editor

A lightweight, Obsidian-style markdown editor for **React**.
Each line is rendered as formatted markdown by default and becomes an editable `<textarea>` only while focused.

The package is designed as a controlled React component with extension hooks rather than as a full document platform.

## Installation

```bash
npm i hybrid-markdown-editor
```

### Peer dependencies

- `react >= 18`
- `react-dom >= 18`
- `react-textarea-autosize >= 8`

## Quick start

```tsx
import { useState } from 'react';
import { HybridMarkdownEditor } from 'hybrid-markdown-editor';

export default function App() {
  const [value, setValue] = useState('# Title\n- item');

  return (
    <HybridMarkdownEditor
      value={value}
      onChange={setValue}
      onDebouncedChange={(v) => console.log('save', v)}
      debounceMs={1000}
    />
  );
}
```

## Key features

- Per-line editing with auto-resizing textareas
- Automatic list continuation on **Enter**
- Smart **Backspace** behavior for list markers and indentation
- Multi-line selection and deletion
- Inline bold syntax while typing
- Controlled value / change API
- Hooks for keyboard, paste, and custom rendering behavior
- Styling hooks without forcing a design system

## Architecture

The editor uses a deliberately simple model:

```text
controlled markdown string
        │
        ▼
parsed lines
├── line 0 → rendered preview
├── line 1 → active textarea
├── line 2 → rendered preview
└── ...
        │
        ▼
onChange(nextMarkdown)
```

Only the active line switches into editing mode. The remaining lines stay rendered.

That avoids the complexity of maintaining a second independent document model while still providing an editor that feels closer to rendered Markdown than a plain textarea.

### Core state model

- **Document value:** owned by the consumer as a normal Markdown string.
- **Line representation:** derived from that value.
- **Active line:** the line currently receiving keyboard/caret interaction.
- **Extensions:** receive a small editing API rather than direct ownership of internal component state.

The controlled-component boundary is intentional: persistence, collaboration, history, autosave, and application state remain the responsibility of the host application.

## Performance considerations

Typing is the hottest path in an editor, so operations inside line-change handlers matter more than work performed during occasional configuration changes.

A previous implementation rebuilt changed line arrays through a full `.map()` pass on every edit. That path was replaced with a shallow copy plus direct index assignment before joining the document. A benchmark over large line arrays measured roughly a 31% improvement for that operation.

The broader rule is to optimize measured interaction paths without adding caches whose invalidation cost would make the editor harder to reason about.

## Design tradeoffs

### Line-oriented rendering

**Benefit:** inactive content can look rendered while the active line remains a normal textarea with familiar browser editing semantics.

**Cost:** operations spanning complex block structures are harder than in an AST-first editor.

### Controlled string value

**Benefit:** simple React integration and no hidden persistence model.

**Cost:** sufficiently large documents require care because the Markdown string and line representation are reconstructed as edits occur.

### Textarea editing instead of `contenteditable`

**Benefit:** predictable caret/input behavior and fewer browser-specific rich-text edge cases.

**Cost:** rich inline WYSIWYG editing is intentionally outside the package's scope.

### Extension API instead of exposing internals

**Benefit:** consumers can add keyboard/paste/decorating behavior without coupling themselves to component implementation details.

**Cost:** extensions can only perform operations represented by the public API.

## How it works

The editor is essentially a list of lines:

- **Line** = one row of Markdown text
- **Active line** = the focused editable `<textarea>`
- **Inactive line** = rendered Markdown preview

Supported line types include:

- `h1`, `h2`, `h3`, `h4`
- list items, including tasks and ordered lists
- blockquotes
- paragraphs

## DOM structure

```html
<div class="editor-root">
  <div class="editor-content">
    <div data-line-index="0" class="line h1">
      <div data-role="line-content"></div>
      <!-- textarea replaces the preview while active -->
    </div>
  </div>
</div>
```

Useful selectors:

- `[data-line-index="N"]` → a specific line
- `[data-role="line-content"]` → rendered line content

## Styling

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  classNames={{
    root: 'my-editor-root',
    content: 'my-editor-content',
    activeLine: 'my-editor-active-line',
    lineTypes: {
      h1: 'heading-1',
      h2: 'heading-2',
      li: 'list-item',
      blockquote: 'blockquote',
      p: 'paragraph',
    },
    line: ({ type }) => (type === 'li' ? 'list-item-custom' : ''),
  }}
/>
```

Applied class order per line:

`lineTypes[type]` → `activeLine` (when focused) → `line`

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `string` | Controlled Markdown value |
| `onChange` | `(v) => void` | Fires on every edit |
| `onDebouncedChange` | `(v) => void` | Fires after debounce delay |
| `debounceMs` | `number` | Debounce delay, default `1000` |
| `readOnly` | `boolean` | Read-only mode |
| `className` | `string` | Extra root class |
| `classNames` | `object` | Styling hooks |
| `renderLine` | `function` | Custom renderer |
| `options` | `object` | Behavior options |

### Behavior options

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  options={{
    indentSize: 4,
    continueListsOnEnter: false,
    pasteSplitLines: true,
  }}
/>
```

## Extensions API

```ts
type EditorExtension = {
  onKeyDown?: (e, api) => boolean | void;
  onPaste?: (e, api) => boolean | void;
  renderLinePrefix?: (ctx) => React.ReactNode;
  renderLineSuffix?: (ctx) => React.ReactNode;
}

type ExtensionApi = {
  getValue: () => string;
  setValue: (next: string) => void;
  getLine: (index: number) => string | undefined;
  setLine: (index: number, next: string) => void;
  insertLine: (index: number, value: string) => void;
  deleteLines: (start: number, count: number) => void;
  getActiveLineIndex: () => number | null;
  setActiveLineIndex: (idx: number | null, caret?: number | null) => void;
}
```

### Example extension: toggle TODOs

```tsx
const todoExtension = {
  onKeyDown: (e, api) => {
    if (e.ctrlKey && e.key.toLowerCase() === 't') {
      const idx = api.getActiveLineIndex();
      if (idx == null) return;

      const line = api.getLine(idx) ?? '';
      api.setLine(idx, line.replace(/^(\s*[-*]\s)\[ \]/, '$1[x]'));

      e.preventDefault();
      return true;
    }
  },
};
```

## Verification

The package includes a Vitest suite and now runs tests and package builds in GitHub Actions for pushes and pull requests.

```bash
npm test
npm run build
```

## Scope / known limitations

This project intentionally does **not** try to be a complete ProseMirror/TipTap-style document engine.

- Complex nested block editing is limited by the line-oriented model.
- Collaborative editing/CRDT behavior is outside the package.
- Persistence and undo history belong to the host application.
- Very large documents may eventually require virtualization or a different underlying document representation.

Those are deliberate boundaries: the package aims to stay understandable and embeddable rather than absorb every editor responsibility.

## License

MIT
