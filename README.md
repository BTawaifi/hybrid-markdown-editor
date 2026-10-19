# Hybrid Markdown Editor

Markdown editing and rendering for React, in two components:

- **`HybridMarkdownEditor`**: an Obsidian-style editor. Your document shows fully formatted, and clicking a line turns just that line into plain text to edit.
- **`ChatMarkdownRenderer`**: a safe, read-only renderer for displaying Markdown, such as AI chat replies, notes and docs.

Both support headings, lists, task checkboxes, tables, code with syntax colours, math, quotes, GitHub alerts, light/dark themes and optional widgets (step flows, checklists, cards…). Raw HTML is never executed.

---

## Contents

1. [Install](#1-install)
2. [Quick start](#2-quick-start)
3. [Recipes](#3-recipes)
4. [Widgets](#4-widgets)
5. [Keyboard shortcuts](#5-keyboard-shortcuts)
6. [Props reference](#6-props-reference)
7. [Styling and themes](#7-styling-and-themes)
8. [Extensions](#8-extensions)
9. [Security, limits and upgrading](#9-security-limits-and-upgrading)

---

## 1. Install

```bash
npm install hybrid-markdown-editor
```

You also need React 18 or newer (`react` and `react-dom`), which your app almost certainly has already. Nothing else to install or configure: no CSS imports, fonts or plugins.

---

## 2. Quick start

### Edit Markdown

```tsx
import { useState } from "react";
import { HybridMarkdownEditor } from "hybrid-markdown-editor";

export default function NoteEditor() {
  const [markdown, setMarkdown] = useState("# My note\n\n- [ ] Try clicking this line");

  return <HybridMarkdownEditor value={markdown} onChange={setMarkdown} />;
}
```

That's a complete editor. Click any line to edit it. Click elsewhere or press **Escape** to stop editing.

### Display Markdown

```tsx
import { ChatMarkdownRenderer } from "hybrid-markdown-editor";

export function Message({ text }: { text: string }) {
  return <ChatMarkdownRenderer markdown={text} />;
}
```

### Using Next.js?

Both components work with the App Router out of the box. The package is marked `"use client"`, so you can import it straight into a page or layout.

---

## 3. Recipes

Each recipe is a small, complete change you can copy.

### Save automatically

`onChange` fires on every keystroke. `onDebouncedChange` fires once the user pauses, which is ideal for saving.

```tsx
<HybridMarkdownEditor
  value={markdown}
  onChange={setMarkdown}
  onDebouncedChange={(text) => localStorage.setItem("note", text)}
  debounceMs={800}
/>
```

### Show a "rendered" view with an Edit button

```tsx
<HybridMarkdownEditor value={markdown} onChange={setMarkdown} presentation="preview" />
```

The whole document renders like `ChatMarkdownRenderer`, with **Edit** and **Preview** buttons to switch.

### Make it read-only

```tsx
<HybridMarkdownEditor value={markdown} readOnly />
```

### Dark mode

```tsx
<ChatMarkdownRenderer markdown={text} theme="dark" />                          {/* "light", "dark" or "system" */}
<HybridMarkdownEditor value={md} onChange={setMd} chatMarkdownProps={{ theme: "dark" }} />
```

The default is `"system"`, which follows the user's OS setting.

### Save checkbox clicks

- **In the editor**, clicking a task checkbox changes `[ ]` to `[x]` in your Markdown and calls `onChange`. Nothing to do.
- **In the renderer**, checkboxes toggle on screen. To save the change, use `onTaskToggle`. `line` is the 0-based line number in your Markdown:

```tsx
<ChatMarkdownRenderer
  markdown={text}
  onTaskToggle={(line, checked) => {
    const lines = text.split("\n");
    lines[line] = lines[line].replace(/\[[ xX]\]/, checked ? "[x]" : "[ ]");
    setText(lines.join("\n"));
  }}
/>
```

### Use a smaller bundle

Built-in math (KaTeX) and code colours (highlight.js) are most of the package size. If you don't need them, import from `/lite`. It has the same components and props:

```tsx
import { HybridMarkdownEditor, ChatMarkdownRenderer } from "hybrid-markdown-editor/lite";
```

| Import | Minified | Gzipped |
| --- | --- | --- |
| `hybrid-markdown-editor` | 389 KB | 117 KB |
| `hybrid-markdown-editor/lite` | 53 KB | 17 KB |

In the lite build, math shows as its source (`x^2`) and code as plain text. You can still plug in your own:

```tsx
<ChatMarkdownRenderer
  markdown={text}
  renderMath={(latex, display) => <MyMath latex={latex} block={display} />}
  highlightCode={(code, language) => <MyHighlighter code={code} lang={language} />}
/>
```

---

## 4. Widgets

Widgets are special code blocks that render as interactive cards. They're **off by default**, because other Markdown apps (GitHub, Obsidian) will show them as ordinary code blocks. Turn them on with `widgets`:

```tsx
<ChatMarkdownRenderer markdown={text} widgets />
<HybridMarkdownEditor value={md} onChange={setMd} chatMarkdownProps={{ widgets: true }} />
```

Each widget is a fenced block. Items are one per line, with ` | ` between parts. Optional parts can be left out.

````md
```flow
Browser | Fetch JS
React | Render UI
Display | Content
```
````

| Widget | Each line | What you get |
| --- | --- | --- |
| `flow` | `Step \| detail` | Step cards with arrows. Horizontal for up to 4 steps, otherwise vertical. Force one with `flow vertical` or `flow horizontal`. |
| `checklist` | `- [ ] item \| value \| detail` | Checkboxes with a done count, an optional right-aligned value (`200 g`) and a detail line |
| `roadmap` | `- [ ] item \| tag \| detail` | Numbered steps with tags and a progress bar |
| `cards` | `Title \| body \| note \| badge` | Stacked cards. Use `cards grid` for tiles. |
| `choice` | `- Option \| recommendation \| detail \| note` | Radio options; the recommendation updates when you pick one |
| `callout` | free text (blank line between paragraphs) | A highlighted note. Variants: `callout tip`, `note`, `warning`, `important`. |

Most widgets accept a `title:` line before the items. `choice` also takes `prompt:`, and `roadmap` takes `unit:`, e.g. `unit: chapters`:

````md
```checklist
title: Ingredients
- [ ] Pasta | 200 g
- [x] Spinach | 2 handfuls | Wash it first
```
````

---

## 5. Keyboard shortcuts

While editing a line:

| Key | Does |
| --- | --- |
| **Enter** | New line; lists and quotes continue automatically |
| **Backspace** at the start of a list line | Removes the `- ` / `1. ` / `> ` marker; press again to join with the line above |
| **Tab** / **Shift+Tab** | Indent / outdent a list item |
| **↑** at the start / **↓** at the end of a line | Move to the previous / next line |
| **Ctrl/Cmd+Z** | Undo |
| **Ctrl+Shift+Z** or **Ctrl+Y** | Redo |
| **Escape** | Stop editing (then **Tab** moves on to the rest of the page) |

When the editor itself has focus, **Enter** (or **F2**) resumes editing the last line.

Links, Copy buttons and widget controls inside the editor work normally. Click elsewhere on a line to edit it.

---

## 6. Props reference

### `HybridMarkdownEditor`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `value` | `string` | (required) | The Markdown text |
| `onChange` | `(text) => void` | | Called on every edit |
| `onDebouncedChange` | `(text) => void` | | Called after the user pauses typing |
| `debounceMs` | `number` | `1000` | Pause length for `onDebouncedChange` |
| `readOnly` | `boolean` | `false` | Disables editing |
| `presentation` | `"hybrid"` \| `"preview"` | `"hybrid"` | Line-by-line editing, or a rendered view with an Edit button |
| `chatMarkdownProps` | object | | Renderer options: `theme`, `widgets`, `renderMath`, `highlightCode`, `onTaskToggle` |
| `options` | object | | `indentSize` (default `2`), `continueListsOnEnter` (default `true`), `pasteSplitLines` (default `true`) |
| `className`, `classNames`, `styles` | | | Styling hooks, see [Styling](#7-styling-and-themes) |
| `renderLine` | function | | Replace how an inactive line is drawn (advanced) |
| `extensions` | `EditorExtension[]` | | Custom keys, paste handling and line decorations, see [Extensions](#8-extensions) |

### `ChatMarkdownRenderer`

| Prop | Type | Default | What it does |
| --- | --- | --- | --- |
| `markdown` | `string` | (required) | The Markdown text |
| `theme` | `"system"` \| `"light"` \| `"dark"` | `"system"` | Colour theme |
| `widgets` | `boolean` | `false` | Render [widget](#4-widgets) blocks |
| `onTaskToggle` | `(line, checked) => void` | | Called when a checkbox is clicked |
| `renderMath` | `(latex, display) => ReactNode` | built-in KaTeX | Custom math renderer |
| `highlightCode` | `(code, language) => ReactNode` | built-in highlight.js | Custom code highlighter |
| `className`, `style` | | | Applied to the wrapper element |

---

## 7. Styling and themes

The components bring their own styles. To adjust them:

**Change colours** with CSS variables on the component's `style`:

```tsx
<ChatMarkdownRenderer
  markdown={text}
  style={{ ["--hme-link" as string]: "#c026d3", ["--hme-fg" as string]: "#1f2937" }}
/>
<HybridMarkdownEditor value={md} onChange={setMd} styles={{ root: { ["--hme-link" as string]: "#c026d3" } }} />
```

Available variables: `--hme-fg` (text), `--hme-muted` (secondary text), `--hme-link`, `--hme-border`, `--hme-rule` (lines and quote bars), `--hme-panel` (code block background), `--hme-code` (inline code background).

**Add your own classes or inline styles** to the editor's parts:

```tsx
<HybridMarkdownEditor
  value={md}
  onChange={setMd}
  classNames={{ root: "editor", line: "editor-line", activeLine: "editing", textarea: "editor-input" }}
  styles={{ content: { maxWidth: 720, margin: "0 auto" } }}
/>
```

Class hooks: `root`, `content`, `line` (a string, or a function of `{ index, type, isActive }`), `activeLine`, `preview`, `textarea`, `marker`, and `lineTypes` per line type (`h1`–`h6`, `li`, `blockquote`, `p`). `styles` takes the same parts and is applied after the defaults, so it always wins.

---

## 8. Extensions

Extensions add your own keyboard shortcuts, paste handling or line decorations. Return `true` from a handler to say "handled, skip the default".

```tsx
import type { EditorExtension } from "hybrid-markdown-editor";

// Ctrl+B wraps the current line in **bold**
const boldLine: EditorExtension = {
  onKeyDown: (event, api) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return;
    const index = api.getActiveLineIndex();
    if (index === null) return;
    event.preventDefault();
    api.setLine(index, `**${api.getLine(index)}**`);
    return true;
  },
};

<HybridMarkdownEditor value={md} onChange={setMd} extensions={[boldLine]} />;
```

The `api` object can read and change the document: `getValue`, `setValue`, `getLine`, `setLine`, `insertLine`, `deleteLines`, `getActiveLineIndex` and `setActiveLineIndex`. Changes made through it go through the same path as typing, so `onChange` fires and undo works. Use `renderLinePrefix` / `renderLineSuffix` to draw something before or after each line.

---

## 9. Security, limits and upgrading

**Security.**
- Raw HTML in Markdown is shown as text, never executed.
- `javascript:`, `data:` and similar links are dropped.
- Code is escaped before highlighting, and KaTeX runs with `trust: false`.
- The parser is fuzz-tested, including against slow-regex (ReDoS) inputs.

**Limits.**
- Not supported: footnotes, reference-style links (`[text][id]`) and raw HTML (by design).
- It's a line-based editor, not a full document engine like ProseMirror. Collaborative editing is out of scope.
- Math uses the browser's MathML support, which all current browsers have.

**Upgrading from 1.x?** See the [CHANGELOG](./CHANGELOG.md). The main changes:
- Lines now render with full formatting.
- Task markers are real checkboxes.
- Imports must come from `hybrid-markdown-editor` or `hybrid-markdown-editor/lite`, not `dist/…`.

### Developing

```bash
npm ci
npm test          # vitest
npm run typecheck
npm run build     # outputs dist/ (ESM, CommonJS and type declarations)
```

## License

MIT
