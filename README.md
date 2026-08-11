# Hybrid Markdown Editor

A lightweight, Obsidian-style Markdown editor for React. Inactive lines render as Markdown-like preview content; the active line becomes a normal auto-resizing textarea.

```bash
npm i hybrid-markdown-editor
```

## Core contract

`HybridMarkdownEditor` is a controlled component. **Every document mutation**—typing, Enter, list continuation, Backspace merges, indentation, multi-line paste, rendered selection deletion, and extension API edits—flows through the same change pipeline and calls `onChange(nextMarkdown)`.

```tsx
import { useState } from 'react';
import { HybridMarkdownEditor } from 'hybrid-markdown-editor';

export default function App() {
  const [value, setValue] = useState('# Title\n- item');

  return (
    <HybridMarkdownEditor
      value={value}
      onChange={setValue}
      onDebouncedChange={(next) => console.log('save', next)}
      debounceMs={1000}
    />
  );
}
```

Controlled value echoes from the parent do not cancel the pending local debounce. A genuinely different external value replaces the local document and cancels that stale pending debounce.

## Features

- Per-line editing with auto-resizing textareas
- Controlled `value` / `onChange` behavior across all edit paths
- Debounced change callback for persistence/autosave
- Strict `readOnly` mode
- Automatic unordered, ordered, task-list, and blockquote continuation on Enter
- Selection-aware Enter and multi-line paste
- Smart Backspace line joining and marker removal
- List indentation/dedentation
- Multi-line rendered selection deletion
- Inline `**bold**` preview with source-aware caret mapping
- Distinct preview markers for unordered, ordered, checked, and unchecked task items
- Extension hooks for keyboard, paste, prefix, and suffix behavior
- Class and style hooks for root/content/line/preview/textarea/marker surfaces
- CJS + ESM builds with TypeScript declarations

## Editing model

```text
controlled markdown string
        │
        ▼
internal line projection
├── inactive line → preview + source mapping
├── active line   → textarea
└── ...
        │
        ▼
central commit pipeline
├── update internal projection
├── onChange(nextMarkdown)
└── schedule onDebouncedChange(nextMarkdown)
```

The line projection is not an independent persistence model. External application state remains authoritative.

## Lists and blockquotes

The preview distinguishes list kinds instead of flattening everything to a bullet:

```text
- unordered    → • unordered
7. ordered     → 7. ordered
- [ ] todo     → ☐ todo
- [x] done     → ☑ done
> quote        → > quote
```

Leading indentation is retained visually for nested list/quote previews. When editing, the textarea contains the original Markdown source unchanged.

## Selection and caret mapping

Inactive lines keep the source-backed content in a dedicated `[data-role="source-content"]` element. Extension prefix/suffix decorations live outside that source-mapped element, so decorative text does not shift source offsets.

For custom `renderLine` implementations, the provided `defaultContent` contains the source-mapped element. If a custom renderer keeps that node, clicks inside it retain exact source mapping. Clicks on unrelated custom content safely activate at the end of the source line rather than inventing an incorrect mapping.

Malformed/literal `**` sequences remain literal and are no longer treated as invisible formatting markers by caret mapping.

## Read-only mode

`readOnly` prevents activation, textarea editing, extension editing entry points, and rendered-selection deletion. Changing `readOnly` to `true` while a line is active immediately returns it to preview mode.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `string` | Controlled Markdown value |
| `onChange` | `(value: string) => void` | Fires for every committed document edit |
| `onDebouncedChange` | `(value: string) => void` | Fires after the configured quiet period |
| `debounceMs` | `number` | Debounce delay; default `1000` |
| `readOnly` | `boolean` | Disables all document mutations |
| `className` | `string` | Extra root class |
| `classNames` | `object` | Class hooks for editor surfaces |
| `styles` | `object` | Inline style overrides applied after structural defaults |
| `renderLine` | `function` | Custom inactive-line renderer |
| `options` | `object` | Editing behavior options |
| `extensions` | `EditorExtension[]` | Keyboard/paste/decorating extensions |

### Behavior options

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  options={{
    indentSize: 4,
    continueListsOnEnter: true,
    pasteSplitLines: true,
  }}
/>
```

### Styling hooks

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  classNames={{
    root: 'editor',
    content: 'editor-content',
    line: 'editor-line',
    activeLine: 'editor-line-active',
    preview: 'editor-preview',
    textarea: 'editor-textarea',
    marker: 'editor-marker',
    lineTypes: {
      h1: 'heading-1',
      li: 'list-item',
      blockquote: 'quote',
      p: 'paragraph',
    },
  }}
  styles={{
    textarea: { fontFamily: 'inherit' },
    marker: { minWidth: 24 },
  }}
/>
```

`styles` are spread after the component's structural defaults so consumers can override those defaults without relying on `!important`.

## Extensions API

```ts
type EditorExtension = {
  onKeyDown?: (event, api) => boolean | void;
  onPaste?: (event, api) => boolean | void;
  renderLinePrefix?: (context) => React.ReactNode;
  renderLineSuffix?: (context) => React.ReactNode;
};

type ExtensionApi = {
  getValue: () => string;
  setValue: (next: string) => void;
  getLine: (index: number) => string | undefined;
  setLine: (index: number, next: string) => void;
  insertLine: (index: number, value: string) => void;
  deleteLines: (start: number, count: number) => void;
  getActiveLineIndex: () => number | null;
  setActiveLineIndex: (index: number | null, caret?: number | null) => void;
};
```

Mutation methods on `ExtensionApi` use the same central commit path as built-in edits, including `onChange` and debounced notifications.

Prefix/suffix render hooks run in both preview and active states and receive the actual `isActive` value.

## Keyboard behavior

- **Enter** splits at the current selection and optionally continues the current list/quote.
- **Backspace at column 0** joins with the previous Markdown line.
- **Backspace near a list marker** removes the marker before deleting content.
- **Tab / Shift+Tab** indent or dedent list/quote items.
- **Arrow Up** moves to the previous Markdown line only when the caret is at source column 0.
- **Arrow Down** moves to the next Markdown line only when the caret is at the end of the source line.

Keeping Arrow Up/Down native in the middle of the textarea avoids breaking normal navigation through visually wrapped text.

## Verification

The test suite includes helper-level tests plus interaction/regression tests for the component contract. CI verifies:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
npm audit --audit-level=high
```

Regression coverage includes:

- every built-in mutation path emitting `onChange`
- extension mutations emitting changes
- controlled debounce behavior
- external value replacement
- strict read-only behavior
- selected-text replacement on Enter/paste
- line merges and list-marker removal
- list continuation/indentation/dedentation
- rendered same-line and cross-line deletion
- ordered/task/nested list preview behavior
- extension source-mapping isolation
- malformed bold syntax mapping
- focus/scroll behavior
- Arrow navigation boundaries
- ReDoS-oriented long-input rendering

## Package surface

The npm entry point intentionally exports only:

- `HybridMarkdownEditor`
- `parseBold`
- `mapDisplayOffsetToSourceIndex`
- `EditorExtension`
- `ExtensionApi`
- `HybridMarkdownEditorProps`

Internal test helpers remain outside the public package entry point.

## Scope / known limitations

This is deliberately a line-oriented editor rather than a ProseMirror/TipTap-style document engine.

- Complex nested block semantics are limited by the line model.
- Collaborative editing/CRDT behavior is outside the package.
- Persistence and undo history belong to the host application.
- Very large documents may eventually need virtualization or a different document representation.
- Custom renderers that replace `defaultContent` completely cannot provide exact click-to-source mapping unless they preserve or implement their own source-mapped content.

## License

MIT
