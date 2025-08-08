# hybrid-markdown-editor

Obsidian-like hybrid markdown editor (per-line renderer + inline editing) for React.

## Install

```
npm i hybrid-markdown-editor
```

Peer deps:
- react >= 18
- react-dom >= 18
- react-textarea-autosize >= 8

## Usage

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

## Customization

- classNames: style root, content, active lines, and per-type classes
- renderLine: override line rendering while receiving defaultContent
- options: indentSize, continueListsOnEnter, pasteSplitLines
- extensions: hook into keydown, paste, and render prefixes/suffixes

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  classNames={{
    root: 'h-full',
    content: 'px-6',
    activeLine: 'bg-zinc-100 rounded',
    lineTypes: { li: 'pl-6 relative' },
  }}
  options={{ indentSize: 4, continueListsOnEnter: true }}
/>
```

### Props

- value: string (controlled value)
- onChange?: (value: string) => void (called on every edit)
- onDebouncedChange?: (value: string) => void (called after debounce)
- debounceMs?: number (default 1000)
- readOnly?: boolean (disables editing behaviors)
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

### Styling with classNames

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  classNames={{
    root: 'h-full',
    content: 'prose dark:prose-invert max-w-none px-6 py-4',
    activeLine: 'bg-muted/30 rounded',
    lineTypes: {
      h1: 'text-4xl font-bold mt-6 mb-4',
      h2: 'text-3xl font-semibold mt-5 mb-3',
      li: 'pl-6 relative',
      blockquote: 'border-l-4 pl-4 italic text-muted-foreground',
      p: 'text-base',
    },
    line: ({ index, type, isActive }) => type === 'li' ? 'before:content-["•"] before:absolute before:left-0' : ''
  }}
/>
```

### Custom line rendering

```tsx
<HybridMarkdownEditor
  value={value}
  onChange={setValue}
  renderLine={({ defaultContent, type }) => (
    <div className={type === 'blockquote' ? 'text-muted-foreground' : ''}>
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
    type === 'li' && /\[x\]/i.test(line) ? <span className="ml-2 text-green-600">done</span> : null
  )
}

<HybridMarkdownEditor value={value} onChange={setValue} extensions={[todoExtension]} />
```

## License

MIT


