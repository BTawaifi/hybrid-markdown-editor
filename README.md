# Hybrid Markdown Editor

A lightweight, Obsidian-style markdown editor for **React**.
Each line is rendered as formatted markdown by default, and turns into an editable `<textarea>` only when you focus it.
Supports **headings, lists, blockquotes, and bold syntax** while typing.

---

## Installation

```bash
npm i hybrid-markdown-editor
```

### Peer dependencies

* `react >= 18`
* `react-dom >= 18`
* `react-textarea-autosize >= 8`

---

## Quick Start

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

---

## Key Features

* Per-line editing with auto-resizing textareas
* Continue lists automatically when pressing **Enter** (optional)
* Smart **Backspace** (removes list markers/indentation correctly)
* Multi-line selection and deletion
* Inline **bold syntax** (`**like this**`) visible while typing
* Extensible via hooks for **keydown**, **paste**, and custom rendering

---

## How It Works

The editor is essentially a **list of lines**:

* **Line** = one row of markdown text
* **Active line** = the line currently focused and editable (`<textarea>`)
* All other lines remain in read-only rendered mode

### Line types supported:

* `h1, h2, h3, h4` (headings)
* `li` (list item, including tasks and ordered lists)
* `blockquote`
* `p` (paragraph)

---

## DOM Structure

```html
<div class="editor-root"> <!-- root -->
  <div class="editor-content"> <!-- content -->
    <div data-line-index="0" class="line h1">
      <!-- Not active -->
      <div data-role="line-content"></div>
      <!-- Active -->
      <textarea></textarea>
    </div>
    <div data-line-index="1" class="line li">...</div>
  </div>
</div>
```

**Useful selectors:**

* `[data-line-index="N"]` → specific line
* `[data-role="line-content"]` → rendered line preview

---

## Styling

You can pass class names via `classNames`:

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

**Order of applied classes per line:**
`lineTypes[type]` → `activeLine` (if focused) → `line`

---

## Props

| Prop                | Type          | Description                                 |
| ------------------- | ------------- | ------------------------------------------- |
| `value`             | `string`      | Controlled markdown value                   |
| `onChange`          | `(v) => void` | Fires on every edit                         |
| `onDebouncedChange` | `(v) => void` | Fires after debounce delay                  |
| `debounceMs`        | `number`      | Delay for debounced change (default `1000`) |
| `readOnly`          | `boolean`     | Makes editor read-only                      |
| `className`         | `string`      | Extra root class                            |
| `classNames`        | `object`      | Styling hooks (see above)                   |
| `renderLine`        | `function`    | Custom renderer for each line               |
| `options`           | `object`      | Behavior options (below)                    |

### Behavior Options

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  options={{
    indentSize: 4,              // default 2
    continueListsOnEnter: false, // default true
    pasteSplitLines: true,       // default true
  }}
/>
```

---

## Custom Rendering Example

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

---

## Extensions API

Extensions let you add custom behavior for **keyboard events, paste, or custom line decorations**.

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

---

## Example Extension: Toggle TODOs

```tsx
const todoExtension = {
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
  renderLineSuffix: ({ line, type }) =>
    type === 'li' && /\[x\]/i.test(line)
      ? <span style={{ marginLeft: 8, color: 'green' }}>done</span>
      : null,
};

<HybridMarkdownEditor value={value} onChange={setValue} extensions={[todoExtension]} />
```

---

## License

MIT
