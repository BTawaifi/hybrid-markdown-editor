"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  ChatMarkdownRenderer,
  chatMarkdownCss,
  renderMarkdownBlocks,
  renderMarkdownInline,
  type ChatMarkdownRendererProps,
  type MarkdownRenderOptions,
} from "./ChatMarkdownRenderer";

type TextareaStyle = React.ComponentProps<typeof TextareaAutosize>["style"];

type ListKind = "ul" | "ol" | "task" | "blockquote" | null;
type ListMeta = {
  kind: ListKind;
  indent: string;
  currentMarker: string;
  nextMarker: string;
  number?: number;
};

export type LineType = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "li" | "blockquote" | "p";

export type EditorExtension = {
  onKeyDown?: (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    api: ExtensionApi
  ) => boolean | void;
  onPaste?: (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    api: ExtensionApi
  ) => boolean | void;
  renderLinePrefix?: (ctx: { index: number; line: string; type: LineType; isActive: boolean }) => React.ReactNode;
  renderLineSuffix?: (ctx: { index: number; line: string; type: LineType; isActive: boolean }) => React.ReactNode;
};

export type ExtensionApi = {
  getValue: () => string;
  setValue: (next: string) => void;
  getLine: (index: number) => string | undefined;
  setLine: (index: number, next: string) => void;
  insertLine: (index: number, value: string) => void;
  deleteLines: (start: number, count: number) => void;
  getActiveLineIndex: () => number | null;
  setActiveLineIndex: (idx: number | null, caret?: number | null) => void;
};

export interface HybridMarkdownEditorProps {
  value: string;
  onDebouncedChange?: (value: string) => void;
  onChange?: (value: string) => void;
  debounceMs?: number;
  className?: string;
  readOnly?: boolean;
  /** "hybrid" renders inactive lines and blocks like the renderer; "preview" shows the whole document rendered. */
  presentation?: "hybrid" | "preview";
  /** Renderer options (theme, widgets, math/code hooks) used by both presentations. */
  chatMarkdownProps?: Omit<ChatMarkdownRendererProps, "markdown">;
  classNames?: {
    root?: string;
    content?: string;
    line?: string | ((ctx: { index: number; type: LineType; isActive: boolean }) => string);
    activeLine?: string;
    lineTypes?: Partial<Record<LineType, string>>;
    preview?: string;
    textarea?: string;
    marker?: string;
  };
  styles?: {
    root?: React.CSSProperties;
    content?: React.CSSProperties;
    line?: React.CSSProperties;
    preview?: React.CSSProperties;
    textarea?: TextareaStyle;
    marker?: React.CSSProperties;
  };
  renderLine?: (ctx: {
    index: number;
    line: string;
    type: LineType;
    isActive: boolean;
    defaultContent: React.ReactNode;
  }) => React.ReactNode;
  options?: {
    indentSize?: number;
    continueListsOnEnter?: boolean;
    pasteSplitLines?: boolean;
  };
  extensions?: EditorExtension[];
}

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

const H1_REGEX = /^#{1}\s/;
const H2_REGEX = /^#{2}\s/;
const H3_REGEX = /^#{3}\s/;
const H4_REGEX = /^#{4}\s/;
const H5_REGEX = /^#{5}\s/;
const H6_REGEX = /^#{6}\s/;
const LI_TASK_REGEX = /^\s*[-*+]\s\[[ xX]\]\s/;
const LI_UL_REGEX = /^\s*[-*+]\s/;
const LI_OL_REGEX = /^\s*\d+\.\s/;
const BLOCKQUOTE_REGEX = /^\s*>\s/;
const MARKDOWN_PREFIX_REGEX = /^(?:#{1,6}\s|\s*[-*+]\s\[[ xX]\]\s|\s*[-*+]\s|\s*\d+\.\s|\s*>\s)/;
const BOLD_TOKEN_REGEX = /\*\*([^*]+)\*\*/g;
const INDENT_REGEX = /^(\s*)/;
const LIST_TASK_MATCH_REGEX = /^(\s*)([-*+])\s\[([ xX])\]\s/;
const LIST_UL_MATCH_REGEX = /^(\s*)([-*+])\s/;
const LIST_OL_MATCH_REGEX = /^(\s*)(\d+)\.\s/;
const LIST_BQ_MATCH_REGEX = /^(\s*)>\s/;

export const getMarkdownType = (line: string): LineType => {
  if (H1_REGEX.test(line)) return "h1";
  if (H2_REGEX.test(line)) return "h2";
  if (H3_REGEX.test(line)) return "h3";
  if (H4_REGEX.test(line)) return "h4";
  if (H5_REGEX.test(line)) return "h5";
  if (H6_REGEX.test(line)) return "h6";
  if (LI_TASK_REGEX.test(line)) return "li";
  if (LI_UL_REGEX.test(line)) return "li";
  if (LI_OL_REGEX.test(line)) return "li";
  if (BLOCKQUOTE_REGEX.test(line)) return "blockquote";
  return "p";
};

export const getListMeta = (line: string): ListMeta => {
  const indent = line.match(INDENT_REGEX)?.[1] ?? "";

  const taskMatch = line.match(LIST_TASK_MATCH_REGEX);
  if (taskMatch) {
    const checked = taskMatch[3].toLowerCase() === "x";
    const currentMarker = `${taskMatch[1]}${taskMatch[2]} [${checked ? "x" : " "}] `;
    const nextMarker = `${taskMatch[1]}${taskMatch[2]} [ ] `;
    return { kind: "task", indent, currentMarker, nextMarker };
  }

  const ulMatch = line.match(LIST_UL_MATCH_REGEX);
  if (ulMatch) {
    const marker = `${ulMatch[1]}${ulMatch[2]} `;
    return { kind: "ul", indent, currentMarker: marker, nextMarker: marker };
  }

  const olMatch = line.match(LIST_OL_MATCH_REGEX);
  if (olMatch) {
    const number = parseInt(olMatch[2], 10);
    return {
      kind: "ol",
      indent,
      currentMarker: `${olMatch[1]}${number}. `,
      nextMarker: `${olMatch[1]}${number + 1}. `,
      number,
    };
  }

  const bqMatch = line.match(LIST_BQ_MATCH_REGEX);
  if (bqMatch) {
    const marker = `${bqMatch[1]}> `;
    return { kind: "blockquote", indent, currentMarker: marker, nextMarker: marker };
  }

  return { kind: null, indent, currentMarker: "", nextMarker: "" };
};

type BoldToken = {
  kind: "text" | "bold";
  text: string;
  sourceStart: number;
  sourceEnd: number;
};

const tokenizeBold = (text: string): BoldToken[] => {
  const tokens: BoldToken[] = [];
  let cursor = 0;
  BOLD_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BOLD_TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > cursor) {
      tokens.push({
        kind: "text",
        text: text.slice(cursor, match.index),
        sourceStart: cursor,
        sourceEnd: match.index,
      });
    }
    tokens.push({
      kind: "bold",
      text: match[1],
      sourceStart: match.index,
      sourceEnd: BOLD_TOKEN_REGEX.lastIndex,
    });
    cursor = BOLD_TOKEN_REGEX.lastIndex;
  }
  if (cursor < text.length || tokens.length === 0) {
    tokens.push({ kind: "text", text: text.slice(cursor), sourceStart: cursor, sourceEnd: text.length });
  }
  return tokens;
};

export const parseBold = (text: string): (string | React.ReactElement)[] =>
  tokenizeBold(text).map((token, idx) =>
    token.kind === "bold" ? <strong key={idx}>{token.text}</strong> : token.text
  );

const getRemovedPrefixLength = (line: string): number =>
  line.match(MARKDOWN_PREFIX_REGEX)?.[0].length ?? 0;

const buildVisibleSourceIndices = (line: string): { indices: number[]; end: number } => {
  const prefix = getRemovedPrefixLength(line);
  const content = line.slice(prefix);
  const indices: number[] = [];

  for (const token of tokenizeBold(content)) {
    if (token.kind === "text") {
      for (let i = 0; i < token.text.length; i += 1) {
        indices.push(prefix + token.sourceStart + i);
      }
    } else {
      const visibleStart = token.sourceStart + 2;
      for (let i = 0; i < token.text.length; i += 1) {
        indices.push(prefix + visibleStart + i);
      }
    }
  }

  return { indices, end: line.length };
};

export const mapDisplayOffsetToSourceIndex = (line: string, displayOffset: number): number => {
  const { indices, end } = buildVisibleSourceIndices(line);
  if (indices.length === 0) return end;
  const offset = Number.isFinite(displayOffset) ? Math.max(0, Math.floor(displayOffset)) : 0;
  if (offset >= indices.length) return end;
  return indices[offset];
};

const getFallbackDisplayOffset = (container: HTMLElement, clientX: number): number => {
  const rect = container.getBoundingClientRect();
  const textLen = container.textContent?.length ?? 0;
  if (rect.width <= 1 || textLen === 0) return textLen;
  if (clientX <= rect.left + 4) return 0;
  if (clientX >= rect.right - 4) return textLen;
  const ratio = (clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(textLen, Math.round(ratio * textLen)));
};

export const getClickDisplayOffset = (
  container: HTMLElement,
  clientX: number,
  clientY: number
): number => {
  let caretNode: Node | null = null;
  let caretOffset = 0;
  const anyDoc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };

  try {
    if (typeof anyDoc.caretRangeFromPoint === "function") {
      const range = anyDoc.caretRangeFromPoint(clientX, clientY);
      if (range) {
        caretNode = range.startContainer;
        caretOffset = range.startOffset;
      }
    } else if (typeof anyDoc.caretPositionFromPoint === "function") {
      const pos = anyDoc.caretPositionFromPoint(clientX, clientY);
      if (pos) {
        caretNode = pos.offsetNode;
        caretOffset = pos.offset;
      }
    }
  } catch {
    // Browser caret APIs are optional/experimental. Coordinate fallback below is intentional.
  }

  if (!caretNode || !container.contains(caretNode)) {
    return getFallbackDisplayOffset(container, clientX);
  }

  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    range.setEnd(caretNode, caretOffset);
    return range.toString().length;
  } catch {
    return getFallbackDisplayOffset(container, clientX);
  }
};

const getListMarker = (line: string): string | null => {
  const meta = getListMeta(line);
  if (meta.kind === "ul") return "•";
  if (meta.kind === "ol") return `${meta.number ?? 1}.`;
  if (meta.kind === "task") {
    const taskMatch = line.match(LIST_TASK_MATCH_REGEX);
    return taskMatch?.[3]?.toLowerCase() === "x" ? "☑" : "☐";
  }
  if (meta.kind === "blockquote") return ">";
  return null;
};

/**
 * Maps each character of rendered text back to its source index by matching characters in
 * order. Markup the renderer hides (**, `, link targets, escapes) is skipped; characters the
 * renderer adds (MathML, placeholders) keep the current position.
 */
export const alignDisplayToSource = (source: string, display: string): number[] => {
  const indices: number[] = [];
  let cursor = 0;
  for (const char of display) {
    let found = cursor;
    while (found < source.length && source[found] !== char) found += 1;
    if (found >= source.length) {
      indices.push(Math.min(cursor, source.length));
      continue;
    }
    indices.push(found);
    cursor = found + 1;
  }
  return indices;
};

type Block = { start: number; end: number };
const FENCE_OPEN_REGEX = /^\s{0,3}(`{3,}|~{3,})/;
const TABLE_SEPARATOR_REGEX = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const SETEXT_REGEX = /^\s{0,3}(=+|-+)\s*$/;
const INDENTED_CODE_REGEX = /^(?: {4}|\t)(?=\s*\S)/;
const RULE_REGEX = /^\s{0,3}(?:\*\s*){3,}$|^\s{0,3}(?:-\s*){3,}$|^\s{0,3}(?:_\s*){3,}$/;
/** Text that continues a paragraph (not a heading, list, quote, fence, rule, underline or math). */
const isParagraphLine = (line: string): boolean => {
  const trimmed = line.trim();
  return !!trimmed && !MARKDOWN_PREFIX_REGEX.test(line) && !FENCE_OPEN_REGEX.test(line) && !SETEXT_REGEX.test(line)
    && !RULE_REGEX.test(line) && !trimmed.startsWith("$$") && !trimmed.startsWith("\\[") && !/^\s{0,3}>/.test(line);
};

/**
 * Multi-line constructs that only render correctly as a whole: fenced code (including widget
 * fences), display math, tables and setext headings. Everything else stays line by line.
 */
export const findMarkdownBlocks = (lines: string[]): Block[] => {
  const blocks: Block[] = [];
  // Last non-blank line before each index, computed once (keeps detection linear).
  const previousContentAt: string[] = [];
  let lastContent = "";
  lines.forEach((l, i) => {
    previousContentAt[i] = lastContent;
    if (l.trim()) lastContent = l;
  });
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = line.match(FENCE_OPEN_REGEX);
    if (fence) {
      const marker = fence[1];
      let end = i + 1;
      while (end < lines.length && !(lines[end].trim().length >= marker.length && [...lines[end].trim()].every((c) => c === marker[0]))) end += 1;
      blocks.push({ start: i, end: Math.min(end, lines.length - 1) });
      i = end;
      continue;
    }
    const trimmed = line.trim();
    // Setext heading: a paragraph (one or more lines) directly followed by === or --- is one
    // heading, as in CommonMark; the underline is never a rule then.
    if (isParagraphLine(line) && !INDENTED_CODE_REGEX.test(line) && !isParagraphLine(lines[i - 1] ?? "")) {
      let end = i;
      while (end + 1 < lines.length && isParagraphLine(lines[end + 1])) end += 1;
      if (SETEXT_REGEX.test(lines[end + 1] ?? "")) {
        blocks.push({ start: i, end: end + 1 });
        i = end + 1;
        continue;
      }
    }
    // Quotes (with nesting, lists and code inside) render as one block, like the renderer.
    if (BLOCKQUOTE_REGEX.test(line) || /^\s{0,3}>$/.test(line)) {
      let end = i;
      while (end + 1 < lines.length && (BLOCKQUOTE_REGEX.test(lines[end + 1]) || /^\s{0,3}>$/.test(lines[end + 1]))) end += 1;
      blocks.push({ start: i, end });
      i = end;
      continue;
    }
    // Display math on one line ($$ x $$, \[ x \]) and thematic breaks are one-line blocks.
    if ((trimmed.startsWith("$$") && trimmed.length > 4 && trimmed.endsWith("$$")) || (trimmed.startsWith("\\[") && trimmed.endsWith("\\]") && trimmed.length > 4) || RULE_REGEX.test(line)) {
      blocks.push({ start: i, end: i });
      continue;
    }
    const mathClose = trimmed === "$$" ? "$$" : trimmed === "\\[" ? "\\]" : null;
    if (mathClose) {
      let end = i + 1;
      while (end < lines.length && lines[end].trim() !== mathClose) end += 1;
      blocks.push({ start: i, end: Math.min(end, lines.length - 1) });
      i = end;
      continue;
    }
    if (line.includes("|") && TABLE_SEPARATOR_REGEX.test(lines[i + 1] ?? "") && (lines[i + 1] ?? "").includes("-")) {
      let end = i + 1;
      while (end + 1 < lines.length && lines[end + 1].trim() && lines[end + 1].includes("|")) end += 1;
      blocks.push({ start: i, end });
      i = end;
      continue;
    }
    // Indented code: starts after a blank line, outside list content, and runs while lines stay
    // indented (blank lines inside are kept, trailing ones are not).
    const previousContent = previousContentAt[i];
    if (INDENTED_CODE_REGEX.test(line) && !(lines[i - 1] ?? "").trim() && !LI_UL_REGEX.test(previousContent) && !LI_OL_REGEX.test(previousContent)) {
      let end = i;
      for (let next = i + 1; next < lines.length; next += 1) {
        if (INDENTED_CODE_REGEX.test(lines[next])) end = next;
        else if (lines[next].trim()) break;
      }
      blocks.push({ start: i, end });
      i = end;
      continue;
    }
  }
  return blocks;
};

const editorCss = [
  ".hme-editor{line-height:1.625}.hme-editor:focus-visible{outline:2px solid var(--hme-link);outline-offset:4px;border-radius:6px}",
  ".hme-editor .hme-line{min-height:1.625em}.hme-editor .hme-line [data-role=source-content]{flex:1;min-width:0;overflow-wrap:anywhere}",
  ".hme-editor .hme-line-h1{font-size:1.25em;font-weight:600;line-height:1.4;margin-top:.5em}.hme-editor .hme-line-h2{font-size:1.125em;font-weight:600;margin-top:.4em}",
  ".hme-editor .hme-line-h3,.hme-editor .hme-line-h4,.hme-editor .hme-line-h5,.hme-editor .hme-line-h6{font-weight:600;margin-top:.3em}.hme-editor .hme-checkbox{margin:0;vertical-align:-.1em}.hme-editor .hme-checkbox:disabled{opacity:1}.hme-editor .hme-line [data-role=line-marker]{color:var(--hme-muted);font-variant-emoji:text}",
  ".hme-editor .hme-line-blockquote{color:var(--hme-muted)}.hme-editor textarea{font:inherit;color:inherit;letter-spacing:inherit;line-height:inherit}",
  ".hme-editor .hme-line-raw{font:.875em/1.7 ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;color:var(--hme-muted);white-space:pre-wrap}",
  ".hme-editor .hme-block{cursor:text}.hme-editor .hme-block>:first-child{margin-top:0}.hme-editor .hme-block+.hme-line{margin-top:.25em}",
  ".hme-sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}",
].join("\n");

/** Controls inside rendered content (links, copy buttons, widget inputs) keep their own behaviour. */
const isInteractiveTarget = (target: EventTarget): boolean =>
  !!(target as HTMLElement).closest?.("a,button,input,label,select,textarea,summary,[role=checkbox]");

/** Task checkbox on a list/quote line, including widget rows like "- [ ] item | value". */
const TASK_TOGGLE_REGEX = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/;

/** Which source line a click inside a rendered block belongs to. */
const lineFromBlockClick = (target: HTMLElement, block: Block, lines: string[], clientY?: number): number => {
  const row = target.closest("tr");
  if (row) {
    const inHead = !!row.closest("thead");
    const bodyIndex = row.parentElement ? Array.from(row.parentElement.children).indexOf(row) : 0;
    return Math.min(block.end, inHead ? block.start : block.start + 2 + bodyIndex);
  }
  if (FENCE_OPEN_REGEX.test(lines[block.start] ?? "")) return Math.min(block.end, block.start + 1);
  const box = (target.closest(".hme-block") as HTMLElement | null)?.getBoundingClientRect();
  if (box && box.height > 0 && clientY !== undefined) {
    const ratio = Math.max(0, Math.min(0.999, (clientY - box.top) / box.height));
    return block.start + Math.floor(ratio * (block.end - block.start + 1));
  }
  return block.start;
};

const EditorLineView: React.FC<{
  index: number;
  line: string;
  isActive: boolean;
  readOnly: boolean;
  focusVersion: number;
  // Callbacks take the line index so the editor can pass the same functions to every line.
  onUpdate: (index: number, e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onActivate: (index: number, caret?: number | null) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (index: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  cursorPositionRef: React.MutableRefObject<number | null>;
  isSelectingRef: React.MutableRefObject<boolean>;
  classNames?: HybridMarkdownEditorProps["classNames"];
  styles?: HybridMarkdownEditorProps["styles"];
  renderLine?: HybridMarkdownEditorProps["renderLine"];
  extensionsPrefix?: EditorExtension[];
  extensionsSuffix?: EditorExtension[];
  /** Line belongs to the block being edited: show its source as-is. */
  raw: boolean;
  renderOptions: MarkdownRenderOptions;
  onToggleTask?: (index: number, checked: boolean) => void;
}> = ({
  index,
  line,
  isActive,
  readOnly,
  focusVersion,
  onUpdate,
  onActivate,
  onKeyDown,
  onPaste,
  cursorPositionRef,
  isSelectingRef,
  classNames,
  styles,
  renderLine,
  extensionsPrefix,
  extensionsSuffix,
  raw,
  renderOptions,
  onToggleTask,
}) => {
  const type = getMarkdownType(line);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listMeta = type === "li" || type === "blockquote" ? getListMeta(line) : null;
  const marker = raw ? null : getListMarker(line);
  // Lists indent by nesting; indented plain lines (list continuations) indent the same way.
  const leading = raw ? "" : listMeta ? listMeta.indent : type === "p" ? (line.match(INDENT_REGEX)?.[1] ?? "") : "";
  const indentPx = Math.min(160, leading.replace(/\t/g, "  ").length * 8);
  const headingLevel = !raw && /^h[1-6]$/.test(type) ? Number(type[1]) : undefined;

  useEffect(() => {
    if (!isActive || readOnly || !textareaRef.current) return;
    textareaRef.current.focus();
    const pos = cursorPositionRef.current;
    if (typeof pos === "number") {
      const safe = Math.max(0, Math.min(textareaRef.current.value.length, pos));
      textareaRef.current.setSelectionRange(safe, safe);
      cursorPositionRef.current = null;
    }
    textareaRef.current.scrollIntoView({ block: "nearest" });
  }, [isActive, readOnly, focusVersion, cursorPositionRef]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const caret = e.currentTarget.selectionStart ?? null;
    if (!isSelectingRef.current && typeof caret === "number") {
      cursorPositionRef.current = caret;
    }
    onUpdate(index, e);
  };

  const typeClass = classNames?.lineTypes?.[type] || "";
  const activeClass = isActive ? classNames?.activeLine || "" : "";
  const customLineClass =
    typeof classNames?.line === "function"
      ? classNames.line({ index, type, isActive })
      : classNames?.line || "";

  const prefixLength = raw ? 0 : getRemovedPrefixLength(line);
  const sourceContent = line.slice(prefixLength);
  const defaultContent = (
    <span data-role="source-content">
      {line.trim() === "" ? "\u00A0" : raw ? line : renderMarkdownInline(sourceContent, renderOptions)}
    </span>
  );
  // Caret target for a click at rendered character `offset` (end of line past the last char).
  const sourceIndexAt = (sourceEl: HTMLElement, offset: number): number => {
    const indices = alignDisplayToSource(sourceContent, sourceEl.textContent ?? "");
    return offset >= indices.length ? line.length : prefixLength + indices[offset];
  };

  return (
    <div
      data-line-index={index}
      className={cx("hme-line", `hme-line-${type}`, raw && "hme-line-raw", typeClass, activeClass, customLineClass)}
      style={{ position: "relative", width: "100%", userSelect: "text", ...styles?.line }}
    >
      {isActive && !readOnly ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          {extensionsPrefix?.map((ext, extIndex) => (
            <React.Fragment key={`active-prefix-${extIndex}`}>
              {ext.renderLinePrefix?.({ index, line, type, isActive }) || null}
            </React.Fragment>
          ))}
          <TextareaAutosize
            ref={textareaRef}
            aria-label={`Markdown line ${index + 1}`}
            className={classNames?.textarea}
            value={line}
            onChange={handleChange}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={(event) => onPaste(index, event)}
            onSelect={(e) => {
              const caret = (e.target as HTMLTextAreaElement).selectionStart ?? null;
              if (!isSelectingRef.current && typeof caret === "number") {
                cursorPositionRef.current = caret;
              }
            }}
            autoFocus
            style={{
              width: "100%",
              resize: "none",
              overflow: "hidden",
              background: "transparent",
              outline: "none",
              padding: 0,
              border: "none",
              ...styles?.textarea,
            }}
          />
          {extensionsSuffix?.map((ext, extIndex) => (
            <React.Fragment key={`active-suffix-${extIndex}`}>
              {ext.renderLineSuffix?.({ index, line, type, isActive }) || null}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div
          data-role="line-preview"
          className={classNames?.preview}
          role={headingLevel ? "heading" : undefined}
          aria-level={headingLevel}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: marker ? 8 : 0,
            paddingLeft: indentPx,
            ...styles?.preview,
          }}
          onMouseUp={(event) => {
            if (readOnly || isInteractiveTarget(event.target)) return;
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().length > 0) return;

            const target = event.target as HTMLElement;
            const sourceEl = target.closest('[data-role="source-content"]') as HTMLElement | null;
            if (!sourceEl) {
              onActivate(index, line.length);
              return;
            }
            const offset = getClickDisplayOffset(sourceEl, event.clientX, event.clientY);
            onActivate(index, line.trim() === "" ? 0 : sourceIndexAt(sourceEl, offset));
          }}
        >
          {extensionsPrefix?.map((ext, extIndex) => (
            <React.Fragment key={`prefix-${extIndex}`}>
              {ext.renderLinePrefix?.({ index, line, type, isActive }) || null}
            </React.Fragment>
          ))}
          {marker ? (
            <span
              data-role="line-marker"
              className={classNames?.marker}
              style={{ flex: "0 0 auto", userSelect: "none", ...styles?.marker }}
            >
              {listMeta?.kind === "task" ? (
                <input
                  type="checkbox"
                  className="hme-checkbox"
                  aria-label="Task completed"
                  checked={marker === "\u2611"}
                  disabled={!onToggleTask}
                  onChange={(event) => onToggleTask?.(index, event.target.checked)}
                />
              ) : marker}
            </span>
          ) : null}
          {renderLine
            ? renderLine({ index, line, type, isActive, defaultContent })
            : defaultContent}
          {extensionsSuffix?.map((ext, extIndex) => (
            <React.Fragment key={`suffix-${extIndex}`}>
              {ext.renderLineSuffix?.({ index, line, type, isActive }) || null}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

/** Lines re-render only when their own props change (typing touches one line, not all). */
const EditorLine = React.memo(EditorLineView);

/** A rendered multi-line block; re-renders only when its source or options change. */
const BlockView = React.memo(function BlockView({ start, end, markdown, readOnly, renderOptions, onActivateLine, onToggle }: {
  start: number;
  end: number;
  markdown: string;
  readOnly: boolean;
  renderOptions: MarkdownRenderOptions;
  onActivateLine: (target: HTMLElement, block: Block, clientY: number) => void;
  onToggle: (index: number, checked: boolean) => void;
}) {
  const content = useMemo(
    () => renderMarkdownBlocks(markdown, { ...renderOptions, onTaskToggle: (line, checked) => onToggle(start + line, checked) }),
    [markdown, renderOptions, onToggle, start]
  );
  return (
    <div
      className="hme-block"
      data-block-start={start}
      data-block-end={end}
      onMouseUp={(event) => {
        if (readOnly || isInteractiveTarget(event.target)) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().length > 0) return;
        onActivateLine(event.target as HTMLElement, { start, end }, event.clientY);
      }}
    >
      {content}
    </div>
  );
});

export const HybridMarkdownEditor: React.FC<HybridMarkdownEditorProps> = ({
  value,
  onDebouncedChange,
  onChange,
  debounceMs = 1000,
  className,
  readOnly = false,
  presentation = "hybrid",
  chatMarkdownProps,
  classNames,
  styles,
  renderLine,
  options,
  extensions,
}) => {
  const initialLines = (value || "").split("\n");
  const [lines, setLines] = useState<string[]>(initialLines);
  const linesRef = useRef<string[]>(initialLines);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const lastActiveLineRef = useRef(0);
  const hintId = useId();
  const [focusVersion, setFocusVersion] = useState(0);
  const cursorPositionRef = useRef<number | null>(null);
  const isSelectingRef = useRef(false);
  const selectionAnchorRef = useRef<{ index: number; displayOffset: number; sourceIndex?: number } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const draggingFromTextareaRef = useRef(false);
  const bridgingSelectionRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Undo/redo history of whole-document snapshots, with where the caret was for each.
  type Snapshot = { lines: string[]; line: number | null; caret: number | null };
  const historyRef = useRef<{ past: Snapshot[]; future: Snapshot[]; group: string | null; at: number }>({
    past: [], future: [], group: null, at: 0,
  });
  const onChangeRef = useRef(onChange);
  const onDebouncedChangeRef = useRef(onDebouncedChange);
  const debounceMsRef = useRef(debounceMs);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onDebouncedChangeRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  useEffect(() => {
    debounceMsRef.current = debounceMs;
  }, [debounceMs]);

  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);

  useEffect(() => {
    const incoming = (value || "").split("\n");
    const current = linesRef.current.join("\n");
    if (current === (value || "")) return;
    // A genuinely different external value: earlier snapshots no longer apply.
    historyRef.current = { past: [], future: [], group: null, at: 0 };
    linesRef.current = incoming;
    setLines(incoming);
    setActiveLineIndex((currentIndex) =>
      currentIndex !== null && currentIndex >= incoming.length ? null : currentIndex
    );
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [value]);

  useEffect(() => {
    if (readOnly) setActiveLineIndex(null);
  }, [readOnly]);

  useEffect(() => {
    const handleMouseUp = () => {
      isSelectingRef.current = false;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const scheduleDebouncedChange = (content: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!onDebouncedChangeRef.current) return;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      onDebouncedChangeRef.current?.(content);
    }, Math.max(0, debounceMsRef.current));
  };

  const currentSnapshot = (lines: string[]): Snapshot => {
    const active = contentRef.current?.querySelector("textarea");
    return {
      lines,
      line: active ? lastActiveLineRef.current : null,
      caret: active && document.activeElement === active ? active.selectionStart : null,
    };
  };

  /**
   * Every document mutation goes through here. `group` merges rapid edits of the same kind
   * (typing on one line) into a single undo step; `record: false` is used by undo/redo.
   */
  const commitLines = (
    nextOrUpdater: string[] | ((prev: string[]) => string[]),
    { group, record = true }: { group?: string; record?: boolean } = {}
  ) => {
    if (readOnly) return linesRef.current;
    const prev = linesRef.current;
    const nextRaw = typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
    const next = nextRaw.length === 0 ? [""] : nextRaw;
    const previousContent = prev.join("\n");
    const content = next.join("\n");
    if (content === previousContent) return prev;
    if (record) {
      const history = historyRef.current;
      const now = Date.now();
      if (!group || group !== history.group || now - history.at > 1000) {
        history.past.push(currentSnapshot(prev));
        if (history.past.length > 200) history.past.shift();
      }
      history.future = [];
      history.group = group ?? null;
      history.at = now;
    }
    linesRef.current = next;
    setLines(next);
    onChangeRef.current?.(content);
    scheduleDebouncedChange(content);
    return next;
  };

  const requestFocus = (index: number | null, caret?: number | null) => {
    if (readOnly) return;
    if (typeof caret === "number") cursorPositionRef.current = caret;
    const safeIndex = index === null
      ? null
      : Math.max(0, Math.min(linesRef.current.length - 1, index));
    if (safeIndex !== null) lastActiveLineRef.current = safeIndex;
    setActiveLineIndex(safeIndex);
    setFocusVersion((version) => version + 1);
  };

  /** Flip a task's [ ] / [x] in the source (task lists, widget rows, preview checkboxes). */
  const toggleTask = (index: number, checked: boolean) => {
    if (readOnly) return;
    commitLines((prev) => {
      const line = prev[index];
      if (line === undefined || !TASK_TOGGLE_REGEX.test(line)) return prev;
      const next = [...prev];
      next[index] = line.replace(TASK_TOGGLE_REGEX, (_match, open: string, _state: string, close: string) => open + (checked ? "x" : " ") + close);
      return next;
    });
  };

  const renderMath = chatMarkdownProps?.renderMath;
  const highlightCode = chatMarkdownProps?.highlightCode;
  const widgets = chatMarkdownProps?.widgets;
  const renderOptions = useMemo<MarkdownRenderOptions>(
    () => ({ renderMath, highlightCode, widgets }),
    [renderMath, highlightCode, widgets]
  );

  // Display <-> source mapping against the rendered DOM of a line (matches what the user sees).
  const lineSourceText = (index: number): { line: string; prefix: number } => {
    const line = linesRef.current[index] ?? "";
    const isRaw = !!contentRef.current?.querySelector(`[data-line-index="${index}"].hme-line-raw`);
    return { line, prefix: isRaw ? 0 : getRemovedPrefixLength(line) };
  };
  const displayToSource = (index: number, displayOffset: number): number => {
    const el = getSourceElementByIndex(index);
    const { line, prefix } = lineSourceText(index);
    if (!el || line.trim() === "") return displayOffset <= 0 ? 0 : line.length;
    const indices = alignDisplayToSource(line.slice(prefix), el.textContent ?? "");
    return displayOffset >= indices.length ? line.length : prefix + indices[Math.max(0, displayOffset)];
  };
  const sourceToDisplay = (index: number, sourceIndex: number): number => {
    const el = getSourceElementByIndex(index);
    const { line, prefix } = lineSourceText(index);
    if (!el || line.trim() === "") return 0;
    const indices = alignDisplayToSource(line.slice(prefix), el.textContent ?? "");
    const found = indices.findIndex((value) => prefix + value >= sourceIndex);
    return found === -1 ? indices.length : found;
  };
  const displayLength = (index: number): number => {
    const { line } = lineSourceText(index);
    return line.trim() === "" ? 0 : getSourceElementByIndex(index)?.textContent?.length ?? 0;
  };

  const extensionsWithKeyDown = useMemo(
    () => (extensions || []).filter((ext) => !!ext.onKeyDown),
    [extensions]
  );
  const extensionsWithPaste = useMemo(
    () => (extensions || []).filter((ext) => !!ext.onPaste),
    [extensions]
  );
  const extensionsWithPrefix = useMemo(
    () => (extensions || []).filter((ext) => !!ext.renderLinePrefix),
    [extensions]
  );
  const extensionsWithSuffix = useMemo(
    () => (extensions || []).filter((ext) => !!ext.renderLineSuffix),
    [extensions]
  );

  const getLineElFromNode = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    const element = node instanceof HTMLElement ? node : node.parentElement;
    return element?.closest?.("[data-line-index]") as HTMLElement | null;
  };

  const getSourceElFromLineEl = (lineEl: HTMLElement | null): HTMLElement | null =>
    (lineEl?.querySelector('[data-role="source-content"]') as HTMLElement | null) ?? null;

  const getDisplayOffsetInLine = (sourceEl: HTMLElement, node: Node, nodeOffset: number): number => {
    try {
      const range = document.createRange();
      range.selectNodeContents(sourceEl);
      range.setEnd(node, nodeOffset);
      return range.toString().length;
    } catch {
      return 0;
    }
  };

  const getSourceElementByIndex = (index: number): HTMLElement | null =>
    (contentRef.current?.querySelector(
      `*[data-line-index="${index}"] [data-role="source-content"]`
    ) as HTMLElement | null) ?? null;

  const setSelectionFromDisplayPoints = (
    startIndex: number,
    startDisplayOffset: number,
    endIndex: number,
    endDisplayOffset: number
  ) => {
    const startEl = getSourceElementByIndex(startIndex);
    const endEl = getSourceElementByIndex(endIndex);
    if (!startEl || !endEl) return;

    const resolvePoint = (element: HTMLElement, displayOffset: number): { node: Node; offset: number } | null => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let remaining = Math.max(0, displayOffset);
      let node = walker.nextNode();
      while (node) {
        const len = node.textContent?.length ?? 0;
        if (remaining <= len) return { node, offset: Math.min(len, remaining) };
        remaining -= len;
        node = walker.nextNode();
      }
      return element.lastChild ? { node: element, offset: element.childNodes.length } : null;
    };

    const start = resolvePoint(startEl, startDisplayOffset);
    const end = resolvePoint(endEl, endDisplayOffset);
    const selection = window.getSelection();
    if (!start || !end || !selection) return;

    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // Ignore transient DOM changes while switching an active textarea back to preview mode.
    }
  };

  const createExtensionApi = (): ExtensionApi => ({
    getValue: () => linesRef.current.join("\n"),
    setValue: (next) => commitLines(next.split("\n")),
    getLine: (index) => linesRef.current[index],
    setLine: (index, nextLine) => {
      if (index < 0 || index >= linesRef.current.length) return;
      commitLines((prev) => {
        const next = [...prev];
        next[index] = nextLine;
        return next;
      });
    },
    insertLine: (index, nextLine) => {
      const safeIndex = Math.max(0, Math.min(linesRef.current.length, index));
      commitLines((prev) => {
        const next = [...prev];
        next.splice(safeIndex, 0, nextLine);
        return next;
      });
    },
    deleteLines: (start, count) => {
      const safeStart = Math.max(0, start);
      const safeCount = Math.max(0, count);
      commitLines((prev) => {
        const next = [...prev];
        next.splice(safeStart, safeCount);
        return next;
      });
    },
    getActiveLineIndex: () => activeLineIndex,
    setActiveLineIndex: (index, caret) => requestFocus(index, caret),
  });

  const handleLineChange = (index: number, nextValue: string) => {
    commitLines((prev) => {
      const next = [...prev];
      next[index] = nextValue;
      return next;
    }, { group: `type:${index}` });
  };

  /** Undo (or redo) one step and put the caret back where that edit happened. */
  const stepHistory = (redo: boolean) => {
    const history = historyRef.current;
    const target = (redo ? history.future : history.past).pop();
    if (!target || readOnly) return;
    (redo ? history.past : history.future).push(currentSnapshot(linesRef.current));
    history.group = null;
    commitLines(target.lines, { record: false });
    if (target.line !== null) {
      const line = Math.min(target.line, target.lines.length - 1);
      requestFocus(line, target.caret ?? (target.lines[line] ?? "").length);
    }
  };
  const isUndoKey = (event: React.KeyboardEvent) =>
    (event.ctrlKey || event.metaKey) && !event.altKey && ["z", "y"].includes(event.key.toLowerCase());
  const handleUndoKey = (event: React.KeyboardEvent) => {
    event.preventDefault();
    stepHistory(event.key.toLowerCase() === "y" || event.shiftKey);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>, index: number) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    if (extensionsWithPaste.length > 0) {
      const api = createExtensionApi();
      for (const extension of extensionsWithPaste) {
        if (extension.onPaste?.(event, api)) return;
      }
    }

    const text = event.clipboardData.getData("text").replace(/\r\n?/g, "\n");
    const pasteSplitLines = options?.pasteSplitLines ?? true;
    if (!pasteSplitLines || !text.includes("\n")) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const line = linesRef.current[index] ?? "";
    const before = line.slice(0, selectionStart);
    const after = line.slice(selectionEnd);
    const pasted = text.split("\n");
    const replacement = [before + pasted[0], ...pasted.slice(1, -1), pasted[pasted.length - 1] + after];

    commitLines((prev) => {
      const next = [...prev];
      next.splice(index, 1, ...replacement);
      return next;
    });

    const newIndex = index + pasted.length - 1;
    requestFocus(newIndex, pasted[pasted.length - 1].length);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    if (extensionsWithKeyDown.length > 0) {
      const api = createExtensionApi();
      for (const extension of extensionsWithKeyDown) {
        if (extension.onKeyDown?.(event, api)) return;
      }
    }

    if (isSelectingRef.current) return;
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const hasSelection = selectionEnd > selectionStart;
    const currentLines = linesRef.current;
    const line = currentLines[index] ?? "";

    if (isUndoKey(event)) {
      handleUndoKey(event);
      return;
    }

    if (event.key === "Escape") {
      // Leave line editing so Tab moves focus out of the editor again (no keyboard trap).
      event.preventDefault();
      setActiveLineIndex(null);
      setTimeout(() => contentRef.current?.focus(), 0);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const meta = getListMeta(line);
      const before = line.slice(0, selectionStart);
      const after = line.slice(selectionEnd);
      const continueLists = options?.continueListsOnEnter ?? true;
      const markerOnly =
        meta.kind !== null &&
        line.slice(meta.currentMarker.length).trim() === "" &&
        selectionStart >= meta.currentMarker.length;

      if (markerOnly) {
        commitLines((prev) => {
          const next = [...prev];
          next[index] = meta.indent;
          return next;
        });
        requestFocus(index, meta.indent.length);
        return;
      }

      const nextMarker = meta.kind && continueLists ? meta.nextMarker : "";
      commitLines((prev) => {
        const next = [...prev];
        next.splice(index, 1, before, nextMarker + after);
        return next;
      });
      requestFocus(index + 1, nextMarker.length);
      return;
    }

    // At the start of a list/quote line, Backspace first turns it into a plain line; only a
    // plain line joins the previous one, so markers never end up mid-line.
    const markerMeta = event.key === "Backspace" && !hasSelection ? getListMeta(line) : null;
    const removesMarker = !!markerMeta?.kind && markerMeta.currentMarker.length > 0 && selectionStart <= markerMeta.currentMarker.length;

    if (event.key === "Backspace" && !hasSelection && selectionStart === 0 && index > 0 && !removesMarker) {
      event.preventDefault();
      const previousLength = currentLines[index - 1].length;
      commitLines((prev) => {
        const next = [...prev];
        next[index - 1] += next[index];
        next.splice(index, 1);
        return next;
      });
      requestFocus(index - 1, previousLength);
      return;
    }

    if (event.key === "Backspace" && !hasSelection) {
      const meta = getListMeta(line);
      if (meta.kind && selectionStart <= meta.currentMarker.length && meta.currentMarker.length > 0) {
        event.preventDefault();
        commitLines((prev) => {
          const next = [...prev];
          next[index] = line.slice(meta.currentMarker.length);
          return next;
        });
        requestFocus(index, 0);
        return;
      }
    }

    if (event.key === "Tab") {
      const meta = getListMeta(line);
      if (meta.kind) {
        event.preventDefault();
        const rawIndentSize = options?.indentSize ?? 2;
        const indentSize = Math.max(
          1,
          Math.min(32, Math.floor(Number.isFinite(rawIndentSize) ? rawIndentSize : 2))
        );

        if (event.shiftKey) {
          const removable = line.startsWith("\t")
            ? 1
            : Math.min(indentSize, line.match(/^ +/)?.[0].length ?? 0);
          if (removable === 0) return;
          commitLines((prev) => {
            const next = [...prev];
            next[index] = line.slice(removable);
            return next;
          });
          requestFocus(index, Math.max(0, selectionStart - removable));
        } else {
          const indent = " ".repeat(indentSize);
          commitLines((prev) => {
            const next = [...prev];
            next[index] = indent + line;
            return next;
          });
          requestFocus(index, selectionStart + indentSize);
        }
        return;
      }
    }

    if (event.key === "ArrowUp" && !hasSelection && selectionStart === 0 && index > 0) {
      event.preventDefault();
      requestFocus(index - 1, Math.min(currentLines[index - 1].length, selectionStart));
      return;
    }

    if (
      event.key === "ArrowDown" &&
      !hasSelection &&
      selectionStart === line.length &&
      index < currentLines.length - 1
    ) {
      event.preventDefault();
      requestFocus(index + 1, Math.min(currentLines[index + 1].length, selectionStart));
    }
  };

  const deleteCurrentSelection = () => {
    if (readOnly) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const container = contentRef.current;
    if (!container || !container.contains(selection.anchorNode) || !container.contains(selection.focusNode)) return;

    const anchorLineEl = getLineElFromNode(selection.anchorNode);
    const focusLineEl = getLineElFromNode(selection.focusNode);
    const anchorSourceEl = getSourceElFromLineEl(anchorLineEl);
    const focusSourceEl = getSourceElFromLineEl(focusLineEl);
    if (!anchorLineEl || !focusLineEl || !anchorSourceEl || !focusSourceEl) return;

    const anchorIndex = Number(anchorLineEl.dataset.lineIndex);
    const focusIndex = Number(focusLineEl.dataset.lineIndex);
    if (!Number.isInteger(anchorIndex) || !Number.isInteger(focusIndex)) return;

    const anchorDisplay = getDisplayOffsetInLine(anchorSourceEl, selection.anchorNode!, selection.anchorOffset);
    const focusDisplay = getDisplayOffsetInLine(focusSourceEl, selection.focusNode!, selection.focusOffset);

    let startIndex = anchorIndex;
    let startDisplay = anchorDisplay;
    let endIndex = focusIndex;
    let endDisplay = focusDisplay;
    if (anchorIndex > focusIndex || (anchorIndex === focusIndex && anchorDisplay > focusDisplay)) {
      startIndex = focusIndex;
      startDisplay = focusDisplay;
      endIndex = anchorIndex;
      endDisplay = anchorDisplay;
    }

    const currentLines = linesRef.current;
    const startLine = currentLines[startIndex] ?? "";
    const endLine = currentLines[endIndex] ?? "";
    const startIsLineStart = startDisplay === 0;
    const endIsLineEnd = endDisplay >= displayLength(endIndex);
    const startSource = displayToSource(startIndex, startDisplay);
    const endSource = endIsLineEnd ? endLine.length : displayToSource(endIndex, endDisplay);

    const nextLines = commitLines((prev) => {
      const next = [...prev];
      if (startIndex === endIndex) {
        if (startIsLineStart && endIsLineEnd) {
          next.splice(startIndex, 1);
        } else {
          const current = next[startIndex] ?? "";
          next[startIndex] = current.slice(0, startSource) + current.slice(endSource);
        }
        return next;
      }

      const merged = startLine.slice(0, startSource) + endLine.slice(endSource);
      next.splice(startIndex, endIndex - startIndex + 1, merged);
      return next;
    });

    requestFocus(Math.min(startIndex, nextLines.length - 1), startSource);
  };

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (readOnly || (event.key !== "Backspace" && event.key !== "Delete")) return;
      const selection = window.getSelection();
      const container = contentRef.current;
      if (!selection || selection.isCollapsed || !container) return;
      if (!container.contains(selection.anchorNode) || !container.contains(selection.focusNode)) return;
      event.preventDefault();
      deleteCurrentSelection();
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [readOnly]);

  // Stable callbacks for memoized lines/blocks; they always call the latest handlers.
  const latest = useRef({ handleLineChange, handleKeyDown, handlePaste, requestFocus, toggleTask, readOnly, chatMarkdownProps });
  latest.current = { handleLineChange, handleKeyDown, handlePaste, requestFocus, toggleTask, readOnly, chatMarkdownProps };
  const stable = useMemo(() => ({
    update: (index: number, event: React.ChangeEvent<HTMLTextAreaElement>) => latest.current.handleLineChange(index, event.target.value),
    activate: (index: number, caret?: number | null) => latest.current.requestFocus(index, caret),
    keyDown: (index: number, event: React.KeyboardEvent<HTMLTextAreaElement>) => latest.current.handleKeyDown(event, index),
    paste: (index: number, event: React.ClipboardEvent<HTMLTextAreaElement>) => latest.current.handlePaste(event, index),
    toggle: (index: number, checked: boolean) => {
      if (latest.current.readOnly) return;
      latest.current.toggleTask(index, checked);
      latest.current.chatMarkdownProps?.onTaskToggle?.(index, checked);
    },
    activateInBlock: (target: HTMLElement, block: Block, clientY: number) => {
      const index = lineFromBlockClick(target, block, linesRef.current, clientY);
      latest.current.requestFocus(index, (linesRef.current[index] ?? "").length);
    },
  }), []);

  if (presentation === "preview" && (readOnly || activeLineIndex === null)) {
    return (
      <div className={cx(className, classNames?.root)} style={{ position: "relative", ...styles?.root }}>
        {!readOnly && <button type="button" aria-label="Edit Markdown" onClick={() => requestFocus(0, 0)} style={{ float: "right", cursor: "pointer", marginBottom: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid currentColor", background: "transparent", color: "inherit" }}>Edit</button>}
        <ChatMarkdownRenderer
          {...chatMarkdownProps}
          markdown={lines.join("\n")}
          onTaskToggle={(line, checked) => {
            if (readOnly) return; // controlled by the source, so read-only checkboxes stay put
            toggleTask(line, checked);
            chatMarkdownProps?.onTaskToggle?.(line, checked);
          }}
        />
      </div>
    );
  }

  const blocks = findMarkdownBlocks(lines);
  const blockAt = new Map(blocks.map((block) => [block.start, block]));
  const activeBlock = activeLineIndex === null ? undefined : blocks.find((b) => b.start <= activeLineIndex && activeLineIndex <= b.end);
  const inActiveBlock = (index: number) => !!activeBlock && activeBlock.start <= index && index <= activeBlock.end;
  const lineProps = (index: number, line: string, raw: boolean) => ({
    index,
    line,
    isActive: activeLineIndex === index,
    readOnly,
    focusVersion: activeLineIndex === index ? focusVersion : 0,
    onUpdate: stable.update,
    onActivate: stable.activate,
    onKeyDown: stable.keyDown,
    onPaste: stable.paste,
    cursorPositionRef,
    isSelectingRef,
    classNames,
    styles,
    renderLine,
    extensionsPrefix: extensionsWithPrefix,
    extensionsSuffix: extensionsWithSuffix,
    raw,
    renderOptions,
    onToggleTask: readOnly ? undefined : stable.toggle,
  });
  const rows: React.ReactNode[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const block = blockAt.get(index);
    if (block && !inActiveBlock(index)) {
      rows.push(
        <BlockView
          key={`block-${index}`}
          start={block.start}
          end={block.end}
          markdown={lines.slice(block.start, block.end + 1).join("\n")}
          readOnly={readOnly}
          renderOptions={renderOptions}
          onActivateLine={stable.activateInBlock}
          onToggle={stable.toggle}
        />
      );
      index = block.end;
      continue;
    }
    rows.push(<EditorLine key={index} {...lineProps(index, lines[index], inActiveBlock(index))} />);
  }

  return (
    <div
      className={cx("hme-chat-markdown", "hme-editor-root", className, classNames?.root)}
      data-theme={chatMarkdownProps?.theme ?? "system"}
      style={{ position: "relative", display: "flex", flexDirection: "column", ...styles?.root }}
    >
      <style data-hme-editor-styles>{chatMarkdownCss(!!chatMarkdownProps?.widgets) + "\n" + editorCss}</style>
      {presentation === "preview" && !readOnly && (
        <button type="button" aria-label="Preview Markdown" onClick={() => setActiveLineIndex(null)} style={{ alignSelf: "flex-end", cursor: "pointer", marginBottom: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid currentColor", background: "transparent", color: "inherit" }}>Preview</button>
      )}
      {!readOnly && (
        <span id={hintId} className="hme-sr-only">
          Press Enter to edit. While editing, press Escape to stop editing.
        </span>
      )}
      <div
        ref={contentRef}
        className={cx("hme-editor", classNames?.content)}
        style={{ display: "flex", flexDirection: "column", maxWidth: "none", ...styles?.content }}
        // Keyboard entry: when no line is active the editor itself is focusable; Enter resumes editing.
        tabIndex={!readOnly && activeLineIndex === null ? 0 : -1}
        role={readOnly ? undefined : "group"}
        aria-label={readOnly ? undefined : "Markdown editor"}
        aria-describedby={readOnly ? undefined : hintId}
        onKeyDown={(event) => {
          if (readOnly || activeLineIndex !== null || event.target !== event.currentTarget) return;
          if (isUndoKey(event)) {
            handleUndoKey(event);
            return;
          }
          if (event.key === "Enter" || event.key === "F2") {
            event.preventDefault();
            const index = Math.min(lastActiveLineRef.current, linesRef.current.length - 1);
            requestFocus(index, (linesRef.current[index] ?? "").length);
          }
        }}
        onClick={(event) => {
          if (readOnly) return;
          if (event.currentTarget === event.target && activeLineIndex !== null) setActiveLineIndex(null);
        }}
        onMouseDownCapture={(event) => {
          if (readOnly) return;
          const target = event.target as HTMLElement;
          const lineEl = target.closest("[data-line-index]") as HTMLElement | null;
          if (!lineEl) {
            selectionAnchorRef.current = null;
            return;
          }
          const index = Number(lineEl.dataset.lineIndex);
          if (!Number.isInteger(index)) return;

          isSelectingRef.current = true;
          bridgingSelectionRef.current = false;
          const textarea = target.closest("textarea") as HTMLTextAreaElement | null;
          draggingFromTextareaRef.current = !!textarea;

          if (textarea) {
            // Resolved to a display offset once the line renders again (see bridging below).
            selectionAnchorRef.current = { index, displayOffset: -1, sourceIndex: textarea.selectionStart ?? 0 };
            return;
          }

          const sourceEl = target.closest('[data-role="source-content"]') as HTMLElement | null;
          if (sourceEl) {
            selectionAnchorRef.current = {
              index,
              displayOffset: getClickDisplayOffset(sourceEl, event.clientX, event.clientY),
            };
          } else {
            selectionAnchorRef.current = null;
          }
        }}
        onMouseMoveCapture={(event) => {
          if (readOnly || !isSelectingRef.current || !draggingFromTextareaRef.current || (event.buttons & 1) !== 1) return;
          const target = event.target as HTMLElement;
          if (target.closest("textarea")) return;
          const anchor = selectionAnchorRef.current;
          const endLineEl = target.closest("[data-line-index]") as HTMLElement | null;
          const endSourceEl = target.closest('[data-role="source-content"]') as HTMLElement | null;
          if (!anchor || !endLineEl || !endSourceEl) return;

          const endIndex = Number(endLineEl.dataset.lineIndex);
          if (!Number.isInteger(endIndex)) return;
          const endOffset = getClickDisplayOffset(endSourceEl, event.clientX, event.clientY);
          setActiveLineIndex(null);
          bridgingSelectionRef.current = true;
          draggingFromTextareaRef.current = false;
          setTimeout(() => {
            if (anchor.displayOffset < 0) anchor.displayOffset = sourceToDisplay(anchor.index, anchor.sourceIndex ?? 0);
            if (anchor.index <= endIndex) {
              setSelectionFromDisplayPoints(anchor.index, anchor.displayOffset, endIndex, endOffset);
            } else {
              setSelectionFromDisplayPoints(endIndex, endOffset, anchor.index, anchor.displayOffset);
            }
          }, 0);
        }}
        onMouseUp={() => {
          if (readOnly) return;
          isSelectingRef.current = false;
          selectionAnchorRef.current = null;
          draggingFromTextareaRef.current = false;
          bridgingSelectionRef.current = false;
        }}
      >
        {rows}
      </div>
    </div>
  );
};

export default HybridMarkdownEditor;
