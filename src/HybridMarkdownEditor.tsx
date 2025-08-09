"use client";

import React, { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

type ListKind = "ul" | "ol" | "task" | "blockquote" | null;
type ListMeta = {
  kind: ListKind;
  indent: string;
  currentMarker: string;
  nextMarker: string;
  number?: number;
};

type LineType = "h1" | "h2" | "h3" | "h4" | "li" | "blockquote" | "p";

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
  };
  renderLine?: (ctx: {
    index: number;
    line: string;
    type: LineType;
    isActive: boolean;
    defaultContent: React.ReactNode;
  }) => React.ReactNode;
  options?: {
    indentSize?: number; // default 2
    continueListsOnEnter?: boolean; // default true
    pasteSplitLines?: boolean; // default true
  };
  extensions?: EditorExtension[];
}

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

const getMarkdownType = (line: string): LineType => {
  if (/^#{1}\s/.test(line)) return "h1";
  if (/^#{2}\s/.test(line)) return "h2";
  if (/^#{3}\s/.test(line)) return "h3";
  if (/^#{4}\s/.test(line)) return "h4";
  if(/^\s*[-*]\s\[[ xX]\]\s/.test(line)) return "li";
  if(/^\s*[-*]\s/.test(line)) return "li";
  if(/^\s*\d+\.\s/.test(line)) return "li";
  if(/^\s*>\s/.test(line)) return "blockquote";
  return "p";
};

const parseBold = (text: string): (string | React.ReactElement)[] => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const getListMeta = (line: string): ListMeta => {
  const indentMatch = line.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : "";

  const taskMatch = line.match(/^(\s*)([-*])\s\[[ xX]\]\s/);
  if (taskMatch) {
    const isChecked = /\[[xX]\]/.test(line);
    const currentMarker = `${taskMatch[1]}${taskMatch[2]} [${isChecked ? "x" : " "}] `;
    const nextMarker = `${taskMatch[1]}${taskMatch[2]} [ ] `;
    return { kind: "task", indent, currentMarker, nextMarker };
  }

  const ulMatch = line.match(/^(\s*)([-*])\s/);
  if (ulMatch) {
    const marker = `${ulMatch[1]}${ulMatch[2]} `;
    return { kind: "ul", indent, currentMarker: marker, nextMarker: marker };
  }

  const olMatch = line.match(/^(\s*)(\d+)\.\s/);
  if (olMatch) {
    const number = parseInt(olMatch[2], 10);
    const currentMarker = `${olMatch[1]}${number}. `;
    const nextMarker = `${olMatch[1]}${number + 1}. `;
    return { kind: "ol", indent, currentMarker, nextMarker, number };
  }

  const bqMatch = line.match(/^(\s*)>\s/);
  if (bqMatch) {
    const marker = `${bqMatch[1]}> `;
    return { kind: "blockquote", indent, currentMarker: marker, nextMarker: marker };
  }

  return { kind: null, indent, currentMarker: "", nextMarker: "" };
};

const getRemovedPrefixLength = (line: string): number => {
  const h = line.match(/^#{1,4}\s/);
  if (h) return h[0].length;
  const task = line.match(/^\s*[-*]\s\[[ xX]\]\s/);
  if (task) return task[0].length;
  const ul = line.match(/^\s*[-*]\s/);
  if (ul) return ul[0].length;
  const ol = line.match(/^\s*\d+\.\s/);
  if (ol) return ol[0].length;
  const bq = line.match(/^\s*>\s/);
  if (bq) return bq[0].length;
  return 0;
};

const mapDisplayOffsetToSourceIndex = (line: string, displayOffset: number): number => {
  const prefix = getRemovedPrefixLength(line);
  const content = line.slice(prefix);
  let i = 0;
  let displayCount = 0;
  while (i < content.length) {
    if (content.startsWith("**", i)) {
      i += 2;
      continue;
    }
    if (displayCount === displayOffset) {
      return prefix + i;
    }
    i += 1;
    displayCount += 1;
  }
  return line.length;
};

const getClickDisplayOffset = (
  container: HTMLElement,
  clientX: number,
  clientY: number
): number => {
  let caretNode: Node | null = null;
  let caretOffset = 0;
  const anyDoc: any = document as any;
  try {
    if (typeof anyDoc.caretRangeFromPoint === "function") {
      const range: Range = anyDoc.caretRangeFromPoint(clientX, clientY);
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
  } catch {}
  if (!caretNode) {
    const rect = container.getBoundingClientRect();
    const textLen = container.textContent?.length ?? 0;
    if (rect.width <= 1 || textLen === 0) return textLen;
    if (clientX <= rect.left + 4) return 0;
    if (clientX >= rect.right - 4) return textLen;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(textLen, Math.round(ratio * textLen)));
  }
  try {
    const r = document.createRange();
    r.selectNodeContents(container);
    r.setEnd(caretNode, caretOffset);
    return r.toString().length;
  } catch {
    const rect = container.getBoundingClientRect();
    const textLen = container.textContent?.length ?? 0;
    if (rect.width <= 1 || textLen === 0) return textLen;
    if (clientX <= rect.left + 4) return 0;
    if (clientX >= rect.right - 4) return textLen;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(textLen, Math.round(ratio * textLen)));
  }
};

const EditorLine: React.FC<{
  index: number;
  line: string;
  isActive: boolean;
  onUpdate: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  cursorPositionRef: React.MutableRefObject<number | null>;
  isSelectingRef: React.MutableRefObject<boolean>;
  classNames?: HybridMarkdownEditorProps["classNames"];
  renderLine?: HybridMarkdownEditorProps["renderLine"];
  extensions?: EditorExtension[];
}> = ({
  index,
  line,
  isActive,
  onUpdate,
  onFocus,
  onKeyDown,
  onPaste,
  cursorPositionRef,
  isSelectingRef,
  classNames,
  renderLine,
  extensions,
}) => {
  const type = getMarkdownType(line);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
      const pos = cursorPositionRef.current;
      if (typeof pos === "number") {
        textareaRef.current.setSelectionRange(pos, pos);
        cursorPositionRef.current = null;
      }
      textareaRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isActive, line]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const caret = e.currentTarget.selectionStart ?? null;
    if (!isSelectingRef.current && typeof caret === "number") {
      cursorPositionRef.current = caret;
    }
    onUpdate(e);
  };

  const baseLineStyle: React.CSSProperties = {
    width: "100%",
    position: "relative",
    userSelect: "text",
    cursor: "text",
  };
  const typeStyle: React.CSSProperties =
    type === "li"
      ? { paddingLeft: 20 }
      : type === "blockquote"
      ? { borderLeft: "4px solid #ddd", paddingLeft: 16, fontStyle: "italic" }
      : {};
  const activeStyle: React.CSSProperties = isActive ? { backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 6 } : {};
  const typeClass = (classNames?.lineTypes && classNames.lineTypes[type]) || "";
  const activeClass = isActive ? (classNames?.activeLine || "") : "";
  const customLineClass =
    typeof classNames?.line === "function" ? classNames.line({ index, type, isActive }) : classNames?.line || "";

  const defaultRendered = (
    <>
      {line.trim() === ""
        ? "\u00A0"
        : parseBold(
            line
              .replace(/^#+\s/, "")
              .replace(/^\s*[-*]\s\[[ xX]\]\s/, "")
              .replace(/^\s*[-*]\s/, "")
              .replace(/^\s*\d+\.\s/, "")
              .replace(/^\s*>\s/, "")
          )}
    </>
  );

  return (
    <div
      data-line-index={index}
      className={cx(typeClass, activeClass, customLineClass)}
      style={{ ...baseLineStyle, ...typeStyle, ...activeStyle }}
    >
      {type === "li" && (
        <span
          style={{ position: "absolute", left: 0, top: "0.3em", fontSize: "1.1em", lineHeight: 1, pointerEvents: "none", userSelect: "none" }}
        >
          •
        </span>
      )}

      {isActive ? (
        <TextareaAutosize
          ref={textareaRef}
          value={line}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onPaste={onPaste}
          onSelect={(e) => {
            const caret = (e.target as HTMLTextAreaElement).selectionStart ?? null;
            if (!isSelectingRef.current && typeof caret === "number") {
              cursorPositionRef.current = caret;
            }
          }}
          onMouseDown={(ev) => {
            ev.stopPropagation();
          }}
          autoFocus
          className={cx()}
          style={{
            width: "100%",
            resize: "none",
            overflow: "hidden",
            background: "transparent",
            outline: "none",
            padding: 0,
            border: "none",
            paddingLeft: type === "li" ? 20 : 0,
          }}
        />
      ) : (
        <div
          data-role="line-content"
          className={cx()}
          style={{ userSelect: "text", paddingLeft: type === "li" ? 20 : 0 }}
          onMouseUp={(ev) => {
            const sel = window.getSelection();
            const container = ev.currentTarget as HTMLDivElement;
            const clickLike = !sel || sel.isCollapsed || (sel && sel.toString().length === 0);
            if (clickLike) {
              const offsetInDisplay = getClickDisplayOffset(container, ev.clientX, ev.clientY);
              const desired = mapDisplayOffsetToSourceIndex(line, offsetInDisplay);
              (cursorPositionRef as React.MutableRefObject<number | null>).current = desired;
              setTimeout(() => onFocus(), 0);
              return;
            }
          }}
        >
          {extensions?.map((ext) => ext.renderLinePrefix?.({ index, line, type, isActive }) || null)}
          {renderLine
            ? renderLine({ index, line, type, isActive, defaultContent: defaultRendered })
            : defaultRendered}
          {extensions?.map((ext) => ext.renderLineSuffix?.({ index, line, type, isActive }) || null)}
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
  renderLine,
  options,
  extensions,
}) => {
  const [lines, setLines] = useState<string[]>(() => (value || "").split("\n"));
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const cursorPositionRef = useRef<number | null>(null);
  const isSelectingRef = useRef<boolean>(false);
  const selectionAnchorRef = useRef<{ index: number; offset: number } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const draggingFromTextareaRef = useRef<boolean>(false);
  const bridgingSelectionRef = useRef<boolean>(false);

  useEffect(() => {
    setLines((value || "").split("\n"));
    setIsDirty(false);
  }, [value]);

  useEffect(() => {
    if (!isDirty) return;
    const handle = setTimeout(() => {
      const content = lines.join("\n");
      onDebouncedChange?.(content);
      setIsDirty(false);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [lines, isDirty, debounceMs, onDebouncedChange]);

  useEffect(() => {
    const handleMouseUp = () => {
      isSelectingRef.current = false;
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const getLineElFromNode = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    if (node instanceof HTMLElement && node.hasAttribute("data-line-index")) return node;
    let el: HTMLElement | null = node instanceof HTMLElement ? node : node?.parentElement ?? null;
    while (el && !el.hasAttribute("data-line-index")) {
      el = el.parentElement;
    }
    return el;
  };

  const getContentElFromLineEl = (lineEl: HTMLElement | null): HTMLElement | null => {
    if (!lineEl) return null;
    return (lineEl.querySelector('[data-role="line-content"]') as HTMLElement) || null;
  };

  const getDisplayOffsetInLine = (contentEl: HTMLElement, node: Node, nodeOffset: number): number => {
    try {
      const r = document.createRange();
      r.selectNodeContents(contentEl);
      r.setEnd(node, nodeOffset);
      return r.toString().length;
    } catch {
      return 0;
    }
  };

  const getDisplayContentLength = (line: string): number => {
    const stripped = line
      .replace(/^#{1,4}\s/, "")
      .replace(/^\s*[-*]\s\[[ xX]\]\s/, "")
      .replace(/^\s*[-*]\s/, "")
      .replace(/^\s*\d+\.\s/, "")
      .replace(/^\s*>\s/, "")
      .replace(/\*\*/g, "");
    return stripped.length;
  };

  const getLineContentElementByIndex = (idx: number): HTMLElement | null => {
    const container = contentRef.current;
    if (!container) return null;
    const el = container.querySelector(`*[data-line-index="${idx}"] [data-role=\"line-content\"]`);
    return (el as HTMLElement) || null;
  };

  const setSelectionFromDisplayPoints = (
    startIdx: number,
    startDisplayOffset: number,
    endIdx: number,
    endDisplayOffset: number
  ) => {
    const startEl = getLineContentElementByIndex(startIdx);
    const endEl = getLineContentElementByIndex(endIdx);
    if (!startEl || !endEl) return;

    const resolvePoint = (el: HTMLElement, displayOffset: number): { node: Node; offset: number } | null => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      let remaining = displayOffset;
      let node: Node | null = walker.nextNode();
      while (node) {
        const len = (node.textContent || "").length;
        if (remaining <= len) {
          return { node, offset: Math.max(0, Math.min(len, remaining)) };
        }
        remaining -= len;
        node = walker.nextNode();
      }
      const last = el.lastChild as Node | null;
      if (last && last.nodeType === Node.TEXT_NODE) {
        const len = (last.textContent || "").length;
        return { node: last, offset: len };
      }
      const dummy = document.createTextNode("");
      el.appendChild(dummy);
      return { node: dummy, offset: 0 };
    };

    const startPoint = resolvePoint(startEl, startDisplayOffset);
    const endPoint = resolvePoint(endEl, endDisplayOffset);
    if (!startPoint || !endPoint) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const handleLineChange = (idx: number, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
    setIsDirty(true);
    onChange?.(lines.map((l, i) => (i === idx ? value : l)).join("\n"));
  };

  const handlePaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    idx: number
  ) => {
    for (const ext of (extensions || [])) {
      const handled = ext.onPaste?.(e, {
        getValue: () => lines.join("\n"),
        setValue: (next: string) => setLines(next.split("\n")),
        getLine: (i: number) => lines[i],
        setLine: (i: number, s: string) => setLines(prev => { const nx = [...prev]; nx[i] = s; return nx; }),
        insertLine: (i: number, s: string) => setLines(prev => { const nx = [...prev]; nx.splice(i, 0, s); return nx; }),
        deleteLines: (start: number, count: number) => setLines(prev => { const nx = [...prev]; nx.splice(start, count); return nx; }),
        getActiveLineIndex: () => activeLineIndex,
        setActiveLineIndex: (i: number | null, caret?: number | null) => { if (typeof caret === 'number') cursorPositionRef.current = caret; setActiveLineIndex(i); },
      } as ExtensionApi);
      if (handled) return;
    }
    if ((window.getSelection()?.toString() || "").includes("\n")) {
      return;
    }
    const text = e.clipboardData.getData("text");
    const pasteSplit = options?.pasteSplitLines ?? true;
    if (!pasteSplit || !text.includes("\n")) return;

    e.preventDefault();
    const caret = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
    const before = lines[idx].slice(0, caret);
    const after = lines[idx].slice(caret);
    const pasted = text.replace(/\r\n/g, "\n").split("\n");
    setLines((prev) => {
      const next = [...prev];
      const head = before + pasted[0];
      const tail = pasted[pasted.length - 1] + after;
      next[idx] = head;
      if (pasted.length > 1) {
        next.splice(idx + 1, 0, ...pasted.slice(1, -1), tail);
      }
      return next;
    });
    setIsDirty(true);
    const newIndex = idx + pasted.length - 1;
    cursorPositionRef.current = pasted[pasted.length - 1].length;
    setTimeout(() => setActiveLineIndex(newIndex), 0);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    idx: number
  ) => {
    for (const ext of (extensions || [])) {
      const handled = ext.onKeyDown?.(e, {
        getValue: () => lines.join("\n"),
        setValue: (next: string) => setLines(next.split("\n")),
        getLine: (i: number) => lines[i],
        setLine: (i: number, s: string) => setLines(prev => { const nx = [...prev]; nx[i] = s; return nx; }),
        insertLine: (i: number, s: string) => setLines(prev => { const nx = [...prev]; nx.splice(i, 0, s); return nx; }),
        deleteLines: (start: number, count: number) => setLines(prev => { const nx = [...prev]; nx.splice(start, count); return nx; }),
        getActiveLineIndex: () => activeLineIndex,
        setActiveLineIndex: (i: number | null, caret?: number | null) => { if (typeof caret === 'number') cursorPositionRef.current = caret; setActiveLineIndex(i); },
      } as ExtensionApi);
      if (handled) return;
    }
    if (isSelectingRef.current) return;
    const textarea = e.currentTarget;
    const caret = textarea.selectionStart;

    if (e.key === "Enter") {
      e.preventDefault();
      const line = lines[idx];
      const meta = getListMeta(line);
      const before = line.slice(0, caret ?? 0);
      const after = line.slice(caret ?? 0);
      const continueLists = options?.continueListsOnEnter ?? true;
      if (
        meta.kind &&
        line
          .replace(new RegExp("^" + meta.currentMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "")
          .trim() === "" &&
        (caret ?? 0) >= meta.currentMarker.length
      ) {
        setLines((prev) => {
          const next = [...prev];
          next[idx] = meta.indent;
          return next;
        });
        setIsDirty(true);
        cursorPositionRef.current = meta.indent.length;
        setTimeout(() => setActiveLineIndex(idx), 0);
        return;
      }
      setLines((prev) => {
        const next = [...prev];
        if (meta.kind && continueLists) {
          next[idx] = before;
          next.splice(idx + 1, 0, meta.nextMarker + after);
        } else {
          next[idx] = before;
          next.splice(idx + 1, 0, after);
        }
        return next;
      });
      setIsDirty(true);
      cursorPositionRef.current = (meta.kind && continueLists) ? meta.nextMarker.length : 0;
      setTimeout(() => setActiveLineIndex(idx + 1), 0);
      return;
    }

    if (e.key === "Backspace" && (caret ?? 0) === 0 && idx > 0) {
      e.preventDefault();
      const textToPrepend = lines[idx];
      const prevLen = lines[idx - 1].length;
      setLines((prev) => {
        const next = [...prev];
        next[idx - 1] += textToPrepend;
        next.splice(idx, 1);
        return next;
      });
      setIsDirty(true);
      cursorPositionRef.current = prevLen;
      setTimeout(() => setActiveLineIndex(idx - 1), 0);
      return;
    }

    if (e.key === "Backspace") {
      const line = lines[idx];
      const meta = getListMeta(line);
      if (meta.kind && (caret ?? 0) <= meta.currentMarker.length && meta.currentMarker.length > 0) {
        e.preventDefault();
        setLines((prev) => {
          const next = [...prev];
          next[idx] = line.slice(meta.currentMarker.length);
          return next;
        });
        setIsDirty(true);
        cursorPositionRef.current = 0;
        setTimeout(() => setActiveLineIndex(idx), 0);
        return;
      }
    }

    if (e.key === "Tab") {
      const line = lines[idx];
      const meta = getListMeta(line);
      if (meta.kind) {
        e.preventDefault();
        const indentSize = options?.indentSize ?? 2;
        if (e.shiftKey) {
          setLines((prev) => {
            const next = [...prev];
            const re = new RegExp(`^\\s{${indentSize},}`);
            if (re.test(line)) {
              next[idx] = line.replace(new RegExp(`^ {${indentSize}}`), "");
            }
            return next;
          });
          setIsDirty(true);
          cursorPositionRef.current = Math.max(0, (caret ?? 0) - indentSize);
          setTimeout(() => setActiveLineIndex(idx), 0);
        } else {
          setLines((prev) => {
            const next = [...prev];
            next[idx] = " ".repeat(indentSize) + line;
            return next;
          });
          setIsDirty(true);
          cursorPositionRef.current = (caret ?? 0) + indentSize;
          setTimeout(() => setActiveLineIndex(idx), 0);
        }
        return;
      }
    }

    if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      cursorPositionRef.current = caret ?? 0;
      setActiveLineIndex(idx - 1);
      return;
    }
    if (e.key === "ArrowDown" && idx < lines.length - 1) {
      e.preventDefault();
      cursorPositionRef.current = caret ?? 0;
      setActiveLineIndex(idx + 1);
      return;
    }
  };

  const deleteCurrentSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const container = contentRef.current;
    if (!container) return;
    if (!container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) return;

    const anchorLineEl = getLineElFromNode(sel.anchorNode);
    const focusLineEl = getLineElFromNode(sel.focusNode);
    if (!anchorLineEl || !focusLineEl) return;
    const anchorIdxAttr = anchorLineEl.getAttribute("data-line-index");
    const focusIdxAttr = focusLineEl.getAttribute("data-line-index");
    if (!anchorIdxAttr || !focusIdxAttr) return;
    let aIdx = parseInt(anchorIdxAttr, 10);
    let fIdx = parseInt(focusIdxAttr, 10);
    if (Number.isNaN(aIdx) || Number.isNaN(fIdx)) return;
    const anchorContentEl = getContentElFromLineEl(anchorLineEl);
    const focusContentEl = getContentElFromLineEl(focusLineEl);
    if (!anchorContentEl || !focusContentEl) return;

    const aDisplayOffset = getDisplayOffsetInLine(anchorContentEl, sel.anchorNode!, sel.anchorOffset);
    const fDisplayOffset = getDisplayOffsetInLine(focusContentEl, sel.focusNode!, sel.focusOffset);

    let startIdx = aIdx;
    let startDisp = aDisplayOffset;
    let endIdx = fIdx;
    let endDisp = fDisplayOffset;
    if (aIdx > fIdx || (aIdx === fIdx && aDisplayOffset > fDisplayOffset)) {
      startIdx = fIdx; startDisp = fDisplayOffset; endIdx = aIdx; endDisp = aDisplayOffset;
    }

    const startSrc = mapDisplayOffsetToSourceIndex(lines[startIdx] ?? "", startDisp);
    const endSrc = mapDisplayOffsetToSourceIndex(lines[endIdx] ?? "", endDisp);

    setLines((prev) => {
      const next = [...prev];
      if (startIdx === endIdx) {
        const line = next[startIdx] ?? "";
        const fullDispLen = getDisplayContentLength(line);
        const startIsLineStart = startDisp === 0;
        const endIsLineEnd = endDisp === fullDispLen;
        if (startIsLineStart && endIsLineEnd) {
          next.splice(startIdx, 1);
        } else {
          const s = startIsLineStart ? 0 : startSrc;
          const e = endIsLineEnd ? line.length : endSrc;
          next[startIdx] = line.slice(0, s) + line.slice(e);
        }
        return next.length === 0 ? [""] : next;
      }

      const startLine = next[startIdx] ?? "";
      const endLine = next[endIdx] ?? "";
      const startIsLineStart = startDisp === 0;
      const endFullDispLen = getDisplayContentLength(endLine);
      const endIsLineEnd = endDisp === endFullDispLen;
      const startCut = startIsLineStart ? 0 : startSrc;
      const endCut = endIsLineEnd ? endLine.length : endSrc;
      const merged = startLine.slice(0, startCut) + endLine.slice(endCut);
      next.splice(startIdx, endIdx - startIdx + 1, merged);
      return next.length === 0 ? [""] : next;
    });

    cursorPositionRef.current = mapDisplayOffsetToSourceIndex(lines[startIdx] ?? "", startDisp);
    setActiveLineIndex(Math.min(startIdx, lines.length - 1));
    setIsDirty(true);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const container = contentRef.current;
      if (!container) return;
      if (!container.contains(sel.anchorNode) || !container.contains(sel.focusNode)) return;
      e.preventDefault();
      deleteCurrentSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lines]);

  return (
    <div className={cx(className, classNames?.root)} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
      <div
        ref={contentRef}
        className={cx(classNames?.content)}
        style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "none" }}
        onClick={(e) => {
          if (readOnly) return;
          if (e.currentTarget === e.target && activeLineIndex !== null) {
            setActiveLineIndex(null);
          }
        }}
        onMouseDownCapture={(e) => {
          if (readOnly) return;
          const target = e.target as HTMLElement;
          const insideTextarea = !!target.closest("textarea");
          const insideLineContent = !!target.closest('[data-role="line-content"]');
          if (!insideTextarea && !insideLineContent && activeLineIndex !== null) {
            setActiveLineIndex(null);
          }
          isSelectingRef.current = true;
          draggingFromTextareaRef.current = !!insideTextarea;
          bridgingSelectionRef.current = false;
          const lineEl = target.closest('[data-line-index]') as HTMLElement | null;
          const contentEl = target.closest('[data-role="line-content"]') as HTMLElement | null;
          if (lineEl && contentEl) {
            const idxAttr = lineEl.getAttribute("data-line-index");
            const idx = idxAttr ? parseInt(idxAttr, 10) : NaN;
            if (!Number.isNaN(idx)) {
              const sel = window.getSelection();
              if (sel && sel.anchorNode) {
                try {
                  const range = document.createRange();
                  range.selectNodeContents(contentEl);
                  range.setEnd(sel.anchorNode, sel.anchorOffset);
                  const offset = range.toString().length;
                  selectionAnchorRef.current = { index: idx, offset };
                } catch {
                  selectionAnchorRef.current = { index: idx, offset: 0 };
                }
              } else {
                selectionAnchorRef.current = { index: idx, offset: 0 };
              }
            }
          } else {
            selectionAnchorRef.current = null;
          }
        }}
        onMouseMoveCapture={(e) => {
          if (readOnly) return;
    if (!isSelectingRef.current || !draggingFromTextareaRef.current) return;
          const target = e.target as HTMLElement;
          const insideTextarea = !!target.closest("textarea");
          if (!insideTextarea && (e.buttons & 1) === 1) {
            setActiveLineIndex(null);
            const anchor = selectionAnchorRef.current;
            if (anchor) {
              const { index, offset } = anchor;
              const endLineEl = target.closest('[data-line-index]') as HTMLElement | null;
              const endContentEl = target.closest('[data-role="line-content"]') as HTMLElement | null;
              if (endLineEl && endContentEl) {
                const idxAttr = endLineEl.getAttribute("data-line-index");
                const endIdx = idxAttr ? parseInt(idxAttr, 10) : index;
                const endOffset = getClickDisplayOffset(endContentEl, e.clientX, e.clientY);
                setSelectionFromDisplayPoints(index, offset, endIdx, endOffset);
                bridgingSelectionRef.current = true;
              }
            }
            draggingFromTextareaRef.current = false;
          }
        }}
        onMouseUp={(e) => {
          if (readOnly) return;
          const sel = window.getSelection();
          if (bridgingSelectionRef.current && sel && sel.isCollapsed) {
            const target = e.target as HTMLElement;
            const lineEl = target.closest('[data-line-index]') as HTMLElement | null;
            const contentEl = target.closest('[data-role="line-content"]') as HTMLElement | null;
            if (lineEl && contentEl) {
              const idxAttr = lineEl.getAttribute("data-line-index");
              const idx = idxAttr ? parseInt(idxAttr, 10) : null;
              if (idx !== null) {
                const off = getClickDisplayOffset(contentEl, e.clientX, e.clientY);
                cursorPositionRef.current = mapDisplayOffsetToSourceIndex(lines[idx] ?? "", off);
                setActiveLineIndex(idx);
              }
            }
          }
          isSelectingRef.current = false;
          selectionAnchorRef.current = null;
          draggingFromTextareaRef.current = false;
          bridgingSelectionRef.current = false;
        }}
      >
        <div>
          {lines.map((line, idx) => (
            <EditorLine
              key={idx}
              index={idx}
              line={line}
              isActive={activeLineIndex === idx}
              onUpdate={(e) => handleLineChange(idx, e.target.value)}
              onFocus={() => setActiveLineIndex(idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              onPaste={(e) => handlePaste(e, idx)}
              cursorPositionRef={cursorPositionRef}
              isSelectingRef={isSelectingRef}
              classNames={classNames}
              renderLine={renderLine}
              extensions={extensions}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HybridMarkdownEditor;