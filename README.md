## Hybrid Markdown Editor

Obsidian‑like hybrid markdown editor for React. It renders each line as formatted preview, and turns a single line into an input when you focus it. Supports lists, headings, blockquotes, and basic bold syntax while typing.

### Install

```bash
npm i hybrid-markdown-editor
```

Peer dependencies:
- react >= 18
- react-dom >= 18
- react-textarea-autosize >= 8

### Quick start

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

### Features

- Inline editing per line with automatic textarea sizing
- List continuation on Enter (configurable)
- Smart Backspace for removing list markers/indent
- Multi-line selection and deletion across rendered lines
- Bold syntax `**like this**` shown while typing
- Extensible hooks for keydown, paste, and custom line prefix/suffix rendering

### Concepts and terminology

- **root**: The outer wrapper element of the editor. Attach layout or container styles here.
- **content**: The inner container that holds the list of lines. It is a vertical stack of lines.
- **line**: A single row in the editor corresponding to one line of the markdown value. When a line is active, it renders a `<textarea>`; otherwise it renders formatted text.
- **active line**: The line currently focused/being edited. It toggles between preview and input. Use `classNames.activeLine` to visually highlight it.
- **line types**: The semantic type of a line derived from its markdown prefix. Supported types: `h1`, `h2`, `h3`, `h4`, `li` (list item, including tasks and ordered lists), `blockquote`, `p` (plain paragraph).

What this means in practice: the editor is just a list of lines. Clicking a line turns it into a textarea for that line only. The rest remain rendered.

### DOM structure (for styling and testing)

```html
<div class="{className} {classNames.root}"> <!-- root -->
  <div class="{classNames.content}">       <!-- content -->
    <div data-line-index="0" class="{line classes}">
      <!-- When not active: -->
      <div data-role="line-content"></div>
      <!-- When active: -->
      <textarea></textarea>
    </div>
    <div data-line-index="1" class="{line classes}">
      ...
    </div>
    <!-- one container per line -->
  </div>
</div>
```

Useful selectors you can rely on:
- `[data-line-index="N"]`: select a specific line container by index
- `[data-role="line-content"]`: the read-only rendered content of a line

### Styling hooks explained

You can provide classes for different parts via the `classNames` prop:

- `root`: applied to the outermost wrapper.
- `content`: applied to the inner container holding all lines.
- `line`: either a string or a function. If a function, it receives `{ index, type, isActive }` and should return a class string to apply to that specific line.
- `activeLine`: applied in addition to `line` when the line is focused/being edited.
- `lineTypes`: an object to apply classes per semantic type, e.g. `{ h1: 'big', li: 'bullet' }`.

Order of application for each line is: `lineTypes[type]` + `activeLine(if active)` + `line`.

### Props

- value: string (controlled value)
- onChange?: (value: string) => void (fires on every edit)
- onDebouncedChange?: (value: string) => void (fires after debounce)
- debounceMs?: number (default 1000)
- readOnly?: boolean
- className?: string (root wrapper)
- classNames?: object
  - root?: string
  - content?: string
  - line?: string | (ctx: { index; type; isActive }) => string
  - activeLine?: string
  - lineTypes?: Partial<Record<'h1'|'h2'|'h3'|'h4'|'li'|'blockquote'|'p', string>>
- renderLine?: ({ index, line, type, isActive, defaultContent }) => ReactNode
- options?: object
  - indentSize?: number (default 2)
  - continueListsOnEnter?: boolean (default true)
  - pasteSplitLines?: boolean (default true)
- extensions?: EditorExtension[] (see below)

### Styling example

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

### Custom line rendering

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  renderLine={({ defaultContent, type }) => (
    <div style={type === 'blockquote' ? { opacity: 0.8 } : undefined}>
      {defaultContent}
    </div>
  )}
/>
```

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

### Extensions API

```ts
type EditorExtension = {
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>, api: ExtensionApi) => boolean | void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>, api: ExtensionApi) => boolean | void;
  renderLinePrefix?: (ctx: { index: number; line: string; type: LineType; isActive: boolean }) => React.ReactNode;
  renderLineSuffix?: (ctx: { index: number; line: string; type: LineType; isActive: boolean }) => React.ReactNode;
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

Example extension

```tsx
const todoExtension: EditorExtension = {
  onKeyDown: (e, api) => {
    if (e.ctrlKey && e.key.toLowerCase() === 't') {
      const idx = api.getActiveLineIndex();
      if (idx == null) return;
      const line = api.getLine(idx) ?? '';
      const toggled = line.replace(/^(\s*[-*]\s)\[ \]/, '$1[x]');
      api.setLine(idx, toggled);
      e.preventDefault();
      return true;
    }
  },
  renderLineSuffix: ({ line, type }) => (
    type === 'li' && /\[x\]/i.test(line) ? <span style={{ marginLeft: 8, color: 'green' }}>done</span> : null
  )
}

<HybridMarkdownEditor value={value} onChange={setValue} extensions={[todoExtension]} />
```

### License

MIT
