# Changelog

## 2.0.0

A large update: a full chat-style Markdown renderer, a hybrid editor that renders like it, optional widgets, and a lighter build.

### Added
- **`ChatMarkdownRenderer`**: a safe, read-only renderer.
  - Markdown: headings (ATX and setext), emphasis, strikethrough, inline code, links (including bare URLs), images, nested and loose lists, task lists, blockquotes, GitHub alerts (`> [!NOTE]` and friends), rules, GFM tables, fenced and indented code.
  - KaTeX math (`$…$`, `\(…\)`, `$$…$$`, `\[…\]`), with output in native MathML.
  - highlight.js code colouring, with language labels and auto-detection for unlabeled blocks.
  - Light, dark and system themes.
- **Widget fences**, opt-in through `widgets`: `flow`, `checklist`, `roadmap`, `cards` (with `grid` layout and badges), `choice` and `callout`.
- **Clickable task checkboxes.**
  - The renderer toggles locally, or reports changes through `onTaskToggle(line, checked)`.
  - The editor writes `[ ]` / `[x]` back into the source.
- **`hybrid-markdown-editor/lite`**: the same components without KaTeX or highlight.js, 17 KB instead of 117 KB gzipped. Math shows as its source and code as plain text unless you pass `renderMath` / `highlightCode`.
- **Editor**:
  - `presentation="preview"` (full rendered view with an Edit button).
  - Undo/redo (Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y).
  - Keyboard access: the editor is focusable, Enter starts editing, Escape stops editing.
  - Heading semantics for screen readers.
- `package.json` `exports` map with ESM, CommonJS and types for both entries.
- The build keeps the `"use client"` directive, so both components import directly into React Server Components (Next.js App Router).

### Changed (breaking)
- **Hybrid mode renders through the renderer.** Inactive lines get full inline formatting and the renderer's typography; tables, code, math, quotes and widgets render as blocks. Hosts that styled the old unstyled lines will see the new look. The `classNames` / `styles` hooks still apply.
- **Task markers in hybrid mode are real checkboxes** instead of ☐/☑ glyphs.
- **`renderLine`'s `defaultContent`** contains rendered inline nodes instead of bold-only text.
- **Backspace at the start of a list or quote line** removes the marker first; only plain lines join the previous line.
- **Deep imports** (`hybrid-markdown-editor/dist/...`) are no longer allowed by the `exports` map. Import from `hybrid-markdown-editor` or `hybrid-markdown-editor/lite`.

### Fixed
- Emphasis inside asterisk runs (`***x***`, `**a *b***`), `snake_case` underscores, and stray scrollbars on math.
- Clicks in formatted text place the caret at the right source position.
- Typing in large documents: only the edited line and changed blocks re-render (a 3,375-line document went from ~430 ms to ~38 ms per keystroke).

### Dependencies
- `react-textarea-autosize` is now a regular dependency (it was a peer dependency you had to install yourself).
- Peer dependencies: `react` and `react-dom` 18 or newer.
