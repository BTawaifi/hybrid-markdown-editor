"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

type TextareaStyle = React.ComponentProps<typeof TextareaAutosize>["style"];

type ListKind = "ul" | "ol" | "task" | "blockquote" | null;
type ListMeta = {
  kind: ListKind;
  indent: string;
  currentMarker: string;
  nextMarker: string;
  number?: number;
};

export type LineType = "h1" | "h2" | "h3" | "h4" | "li" | "blockquote" | "p";

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
const LI_TASK_REGEX = /^\s*[-*]\s\[[ xX]\]\s/;
const LI_UL_REGEX = /^\s*[-*]\s/;
const LI_OL_REGEX = /^\s*\d+\.\s/;
const BLOCKQUOTE_REGEX = /^\s*>\s/;
const MARKDOWN_PREFIX_REGEX = /^(?:#{1,4}\s|\s*[-*]\s\[[ xX]\]\s|\s*[-*]\s|\s*\d+\.\s|\s*>\s)/;
const BOLD_TOKEN_REGEX = /\*\*([^*]+)\*\*/g;
const INDENT_REGEX = /^(\s*)/;
const LIST_TASK_MATCH_REGEX = /^(\s*)([-*])\s\[([ xX])\]\s/;
const LIST_UL_MATCH_REGEX = /^(\s*)([-*])\s/;
const LIST_OL_MATCH_REGEX = /^(\s*)(\d+)\.\s/;
const LIST_BQ_MATCH_REGEX = /^(\s*)>\s/;

export const getMarkdownType = (line: string): LineType => {
  if (H1_REGEX.test(line)) return "h1";
  if (H2_REGEX.test(line)) return "h2";
  if (H3_REGEX.test(line)) return "h3";
  if (H4_REGEX.test(line)) return "h4";
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
  const offset = Math.max(0, Math.floor(displayOffset));
  if (offset >= indices.length) return end;
  return indices[offset];
};

const mapSourceIndexToDisplayOffset = (line: string, sourceIndex: number): number => {
  const { indices } = buildVisibleSourceIndices(line);
  if (indices.length === 0) return 0;
  const target = Math.max(0, sourceIndex);
  const found = indices.findIndex((index) => index >= target);
  return found === -1 ? indices.length : found;
};

const getDisplayContentLength = (line: string): number => buildVisibleSourceIndices(line).indices.length;

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

const EditorLine: React.FC<{
  index: number;
  line: string;
  isActive: boolean;
  readOnly: boolean;
  focusVersion: number;
  onUpdate: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onActivate: (caret?: number | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  cursorPositionRef: React.MutableRefObject<number | null>;
  isSelectingRef: React.MutableRefObject<boolean>;
  classNames?: HybridMarkdownEditorProps["classNames"];
  styles?: HybridMarkdownEditorProps["styles"];
  renderLine?: HybridMarkdownEditorProps["renderLine"];
  extensionsPrefix?: EditorExtension[];
  extensionsSuffix?: EditorExtension[];
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
}) => {
  const type = getMarkdownType(line);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listMeta = type === "li" || type === "blockquote" ? getListMeta(line) : null;
  const marker = getListMarker(line);
  const indentPx = listMeta ? Math.min(160, listMeta.indent.replace(/\t/g, "  ").length * 8) : 0;

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
    onUpdate(e);
  };

  const typeClass = classNames?.lineTypes?.[type] || "";
  const activeClass = isActive ? classNames?.activeLine || "" : "";
  const customLineClass =
    typeof classNames?.line === "function"
      ? classNames.line({ index, type, isActive })
      : classNames?.line || "";

  const sourceContent = line.replace(MARKDOWN_PREFIX_REGEX, "");
  const defaultContent = (
    <span data-role="source-content">
      {line.trim() === "" ? "\u00A0" : parseBold(sourceContent)}
    </span>
  );

  return (
    <div
      data-line-index={index}
      className={cx(typeClass, activeClass, customLineClass)}
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
            onKeyDown={onKeyDown}
            onPaste={onPaste}
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
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: marker ? 8 : 0,
            paddingLeft: indentPx,
            ...styles?.preview,
          }}
          onMouseUp={(event) => {
            if (readOnly) return;
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().length > 0) return;

            const target = event.target as HTMLElement;
            const sourceEl = target.closest('[data-role="source-content"]') as HTMLElement | null;
            if (!sourceEl) {
              onActivate(line.length);
              return;
            }
            const offset = getClickDisplayOffset(sourceEl, event.clientX, event.clientY);
            onActivate(mapDisplayOffsetToSourceIndex(line, offset));
          }}
        >
          {extensionsPrefix?.map((ext, extIndex) => (
            <React.Fragment key={`prefix-${extIndex}`}>
              {ext.renderLinePrefix?.({ index, line, type, isActive }) || null}
            </React.Fragment>
          ))}
          {marker ? (
            <span data-role="line-marker" className={classNames?.marker} style={{ flex: "0 0 auto", userSelect: "none", ...styles?.marker }}>
              {marker}
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

export const HybridMarkdownEditor: React.FC<HybridMarkdownEditorProps> = ({
  value,
  onDebouncedChange,
  onChange,
  debounceMs = 1000,
  className,
  readOnly = false,
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
  const [focusVersion, setFocusVersion] = useState(0);
  const cursorPositionRef = useRef<number | null>(null);
  const isSelectingRef = useRef(false);
  const selectionAnchorRef = useRef<{ index: number; displayOffset: number } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const draggingFromTextareaRef = useRef(false);
  const bridgingSelectionRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const commitLines = (nextOrUpdater: string[] | ((prev: string[]) => string[])) => {
    if (readOnly) return linesRef.current;
    const prev = linesRef.current;
    const nextRaw = typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
    const next = nextRaw.length === 0 ? [""] : nextRaw;
    const previousContent = prev.join("\n");
    const content = next.join("\n");
    if (content === previousContent) return prev;
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
    setActiveLineIndex(safeIndex);
    setFocusVersion((version) => version + 1);
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
    });
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

    if (event.key === "Backspace" && !hasSelection && selectionStart === 0 && index > 0) {
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
    const endIsLineEnd = endDisplay >= getDisplayContentLength(endLine);
    const startSource = mapDisplayOffsetToSourceIndex(startLine, startDisplay);
    const endSource = endIsLineEnd ? endLine.length : mapDisplayOffsetToSourceIndex(endLine, endDisplay);

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

  return (
    <div
      className={cx(className, classNames?.root)}
      style={{ position: "relative", display: "flex", flexDirection: "column", ...styles?.root }}
    >
      <div
        ref={contentRef}
        className={cx(classNames?.content)}
        style={{ display: "flex", flexDirection: "column", maxWidth: "none", ...styles?.content }}
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
            selectionAnchorRef.current = {
              index,
              displayOffset: mapSourceIndexToDisplayOffset(linesRef.current[index] ?? "", textarea.selectionStart ?? 0),
            };
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
        {lines.map((line, index) => (
          <EditorLine
            key={index}
            index={index}
            line={line}
            isActive={activeLineIndex === index}
            readOnly={readOnly}
            focusVersion={focusVersion}
            onUpdate={(event) => handleLineChange(index, event.target.value)}
            onActivate={(caret) => requestFocus(index, caret)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onPaste={(event) => handlePaste(event, index)}
            cursorPositionRef={cursorPositionRef}
            isSelectingRef={isSelectingRef}
            classNames={classNames}
            styles={styles}
            renderLine={renderLine}
            extensionsPrefix={extensionsWithPrefix}
            extensionsSuffix={extensionsWithSuffix}
          />
        ))}
      </div>
    </div>
  );
};

export default HybridMarkdownEditor;
