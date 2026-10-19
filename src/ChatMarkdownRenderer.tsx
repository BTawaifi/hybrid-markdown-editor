"use client";

import React, { useMemo, useState } from "react";
import { renderBuiltInHighlight, renderBuiltInMath } from "./MarkdownIntegrations";

/**
 * A safe React renderer for chat-style Markdown with built-in math and syntax highlighting.
 * It intentionally does not interpret raw HTML or execute embedded content.
 * Rendering is separate from the editor's source-to-caret mapping.
 */
export type ChatMarkdownRendererProps = {
  markdown: string;
  className?: string;
  style?: React.CSSProperties;
  theme?: "system" | "light" | "dark";
  renderMath?: (latex: string, display: boolean) => React.ReactNode;
  highlightCode?: (code: string, language: string) => React.ReactNode;
};

type RenderOptions = Pick<ChatMarkdownRendererProps, "renderMath" | "highlightCode">;

const markdownCss = [
  ".hme-chat-markdown{--hme-fg:#242424;--hme-muted:#707070;--hme-border:#dedede;--hme-panel:#f5f5f5;--hme-code:#f6f6f6;--hme-link:#1769aa;color:var(--hme-fg);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.75;overflow-wrap:anywhere;}",
  ".hme-chat-markdown[data-theme='dark']{--hme-fg:#e9e9e9;--hme-muted:#aaa;--hme-border:#414141;--hme-panel:#252525;--hme-code:#2b2b2b;--hme-link:#89bdff;}",
  "@media(prefers-color-scheme:dark){.hme-chat-markdown[data-theme='system']{--hme-fg:#e9e9e9;--hme-muted:#aaa;--hme-border:#414141;--hme-panel:#252525;--hme-code:#2b2b2b;--hme-link:#89bdff;}}",
  ".hme-chat-markdown *{box-sizing:border-box}.hme-chat-markdown :first-child{margin-top:0}.hme-chat-markdown :last-child{margin-bottom:0}",
  ".hme-chat-markdown p{margin:0 0 1.05em}.hme-chat-markdown h1,.hme-chat-markdown h2,.hme-chat-markdown h3,.hme-chat-markdown h4,.hme-chat-markdown h5,.hme-chat-markdown h6{font-weight:650;letter-spacing:-.025em;line-height:1.3;margin:1.65em 0 .6em;overflow-wrap:break-word}",
  ".hme-chat-markdown h1{font-size:1.85em}.hme-chat-markdown h2{font-size:1.45em}.hme-chat-markdown h3{font-size:1.2em}.hme-chat-markdown h4{font-size:1.07em}.hme-chat-markdown h5,.hme-chat-markdown h6{font-size:1em}",
  ".hme-chat-markdown strong{font-weight:700}.hme-chat-markdown em{font-style:italic}.hme-chat-markdown del{color:var(--hme-muted)}",
  ".hme-chat-markdown a{color:var(--hme-link);text-decoration:underline;text-underline-offset:3px}.hme-chat-markdown a:hover{text-decoration-thickness:2px}",
  ".hme-chat-markdown ul,.hme-chat-markdown ol{padding-left:1.6em;margin:.55em 0 1.15em}.hme-chat-markdown li{padding-left:.15em;margin:.2em 0}.hme-chat-markdown li>ul,.hme-chat-markdown li>ol{margin:.2em 0 .3em}",
  ".hme-chat-markdown li.hme-task{list-style:none;margin-left:-1.4em}.hme-chat-markdown .hme-checkbox{accent-color:#17803d;margin:0 .6em 0 0;width:1em;height:1em;vertical-align:-.08em}",
  ".hme-chat-markdown blockquote{border-left:3px solid var(--hme-border);padding:.2em 0 .2em 1em;margin:1.35em 0;color:var(--hme-muted)}.hme-chat-markdown blockquote p{margin-bottom:.6em}",
  ".hme-chat-markdown hr{border:0;border-top:1px solid var(--hme-border);margin:1.8em 0}",
  ".hme-chat-markdown :not(pre)>code{background:var(--hme-code);border-radius:5px;padding:.13em .35em;font: .87em/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;white-space:break-spaces}",
  ".hme-chat-markdown .hme-code-block{border:1px solid var(--hme-border);border-radius:12px;overflow:hidden;margin:1.2em 0;background:var(--hme-panel)}",
  ".hme-chat-markdown .hme-code-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--hme-border);padding:.45em .85em;color:var(--hme-muted);font-size:.76em}",
  ".hme-chat-markdown .hme-code-copy{background:transparent;border:0;border-radius:5px;padding:.2em .5em;font:inherit;color:inherit;cursor:pointer}.hme-chat-markdown .hme-code-copy:hover{background:var(--hme-border)}",
  ".hme-chat-markdown .hme-code-block pre{margin:0;overflow-x:auto;padding:1em 1.15em;tab-size:2;line-height:1.6;font: .85em/1.65 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;white-space:pre}",
  ".hme-chat-markdown .hme-table-wrap{overflow-x:auto;margin:1.2em 0;border:1px solid var(--hme-border);border-radius:9px}",
  ".hme-chat-markdown table{border-collapse:collapse;width:100%;min-width:max-content;font-size:.92em;line-height:1.55}",
  ".hme-chat-markdown th,.hme-chat-markdown td{padding:.7em .9em;text-align:left;border-bottom:1px solid var(--hme-border)}",
  ".hme-chat-markdown th{background:var(--hme-panel);font-weight:650}.hme-chat-markdown tr:last-child td{border-bottom:0}",
  ".hme-chat-markdown img{max-width:100%;height:auto;border-radius:8px}.hme-chat-markdown .hme-math-inline{font-family:Georgia,serif;font-style:italic}",
  ".hme-chat-markdown .hme-math-block{display:block;text-align:center;overflow-x:auto;margin:1.3em 0;font-family:Georgia,serif;white-space:pre}",
  ".hme-chat-markdown .hme-language{font-family:ui-monospace,monospace;text-transform:lowercase}",
  ".hme-chat-markdown .hme-math-typeset{display:inline-block;max-width:100%;overflow-x:auto;vertical-align:middle}.hme-chat-markdown .hme-math-display{display:block;text-align:center}.hme-chat-markdown .hme-math-typeset math{font-size:1.1em}.hme-chat-markdown .hme-math-fallback{color:var(--hme-muted)}",
  ".hme-chat-markdown{--hme-syntax-keyword:#a626a4;--hme-syntax-string:#4c7c1e;--hme-syntax-number:#986801;--hme-syntax-comment:#7f848e;--hme-syntax-title:#146fb4;--hme-syntax-symbol:#b06a12;--hme-syntax-attr:#b06a12}",
  ".hme-chat-markdown[data-theme='dark']{--hme-syntax-keyword:#c792ea;--hme-syntax-string:#c3e88d;--hme-syntax-number:#f78c6c;--hme-syntax-comment:#8b949e;--hme-syntax-title:#82aaff;--hme-syntax-symbol:#ffcb6b;--hme-syntax-attr:#ffcb6b}",
  "@media(prefers-color-scheme:dark){.hme-chat-markdown[data-theme='system']{--hme-syntax-keyword:#c792ea;--hme-syntax-string:#c3e88d;--hme-syntax-number:#f78c6c;--hme-syntax-comment:#8b949e;--hme-syntax-title:#82aaff;--hme-syntax-symbol:#ffcb6b;--hme-syntax-attr:#ffcb6b}}",
  ".hme-chat-markdown .hljs-keyword,.hme-chat-markdown .hljs-selector-tag,.hme-chat-markdown .hljs-literal,.hme-chat-markdown .hljs-built_in{color:var(--hme-syntax-keyword)}",
  ".hme-chat-markdown .hljs-string,.hme-chat-markdown .hljs-regexp,.hme-chat-markdown .hljs-addition{color:var(--hme-syntax-string)}",
  ".hme-chat-markdown .hljs-number,.hme-chat-markdown .hljs-meta{color:var(--hme-syntax-number)}",
  ".hme-chat-markdown .hljs-comment,.hme-chat-markdown .hljs-quote{color:var(--hme-syntax-comment);font-style:italic}",
  ".hme-chat-markdown .hljs-title,.hme-chat-markdown .hljs-section,.hme-chat-markdown .hljs-function{color:var(--hme-syntax-title)}",
  ".hme-chat-markdown .hljs-variable,.hme-chat-markdown .hljs-symbol,.hme-chat-markdown .hljs-deletion{color:var(--hme-syntax-symbol)}",
  ".hme-chat-markdown .hljs-attr,.hme-chat-markdown .hljs-attribute,.hme-chat-markdown .hljs-property{color:var(--hme-syntax-attr)}",
].join("\n");

const safeUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (!value || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  if (/^(?:https?:\/\/|mailto:)/i.test(value)) return value;
  // No scheme means a relative URL. Network-path URLs are excluded.
  if (value.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return value;
};

const imageUrl = (raw: string): string | null => {
  const url = safeUrl(raw);
  if (!url || /^mailto:/i.test(url)) return null;
  return url;
};

/** Small inline Markdown parser; React escapes all ordinary text automatically. */
function inline(source: string, opts: RenderOptions, depth = 0): React.ReactNode[] {
  // Avoid superlinear delimiter scans on hostile, unbroken paragraphs.
  if (depth > 8 || source.length > 16000) return [source];
  const out: React.ReactNode[] = [];
  let plain = "";
  let i = 0;
  const flush = () => {
    if (plain) out.push(plain);
    plain = "";
  };
  const emit = (value: React.ReactNode) => {
    flush();
    out.push(<React.Fragment key={out.length}>{value}</React.Fragment>);
  };

  while (i < source.length) {
    const c = source[i];
    if (c === "\\" && source[i + 1] === "(") {
      const close = source.indexOf("\\)", i + 2);
      if (close > i + 2) {
        const latex = source.slice(i + 2, close);
        emit(opts.renderMath ? opts.renderMath(latex, false) : renderBuiltInMath(latex, false));
        i = close + 2;
        continue;
      }
    }
    if (c === "\\" && i + 1 < source.length && /[\\!#$%&'()*+,\-./:;<=>?@[\]^_\x60{|}~]/.test(source[i + 1])) {
      plain += source[i + 1];
      i += 2;
      continue;
    }
    if (c === "\x60") {
      let run = 1;
      while (source[i + run] === "\x60") run++;
      const marker = "\x60".repeat(run);
      const close = source.indexOf(marker, i + run);
      if (close >= 0) {
        emit(<code>{source.slice(i + run, close).replace(/\n/g, " ")}</code>);
        i = close + run;
        continue;
      }
    }
    if (c === "[" || (c === "!" && source[i + 1] === "[")) {
      const isImage = c === "!";
      const begin = i + (isImage ? 2 : 1);
      const end = source.indexOf("]", begin);
      if (end > begin && source[end + 1] === "(") {
        const close = source.indexOf(")", end + 2);
        if (close > end + 2) {
          const label = source.slice(begin, end);
          const address = safeUrl(source.slice(end + 2, close).split(/\s+["']/)[0]);
          if (address) {
            if (isImage) {
              const src = imageUrl(address);
              if (src) {
                emit(<img src={src} alt={label} loading="lazy" />);
                i = close + 1;
                continue;
              }
            } else {
              const external = /^https?:\/\//i.test(address);
              emit(<a href={address} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{inline(label, opts, depth + 1)}</a>);
              i = close + 1;
              continue;
            }
          }
        }
      }
    }
    if (c === "<") {
      const end = source.indexOf(">", i + 1);
      if (end !== -1) {
        const candidate = source.slice(i + 1, end);
        if (/^https?:\/\/[^\s<>]+$/i.test(candidate)) {
          emit(<a href={candidate} target="_blank" rel="noopener noreferrer">{candidate}</a>);
          i = end + 1;
          continue;
        }
      }
    }
    if (c === "$" && source[i + 1] !== "$" && source[i + 1] !== " " && !/[0-9]/.test(source[i + 1] ?? "")) {
      const end = source.indexOf("$", i + 1);
      if (end > i + 1 && source[end - 1] !== "\\") {
        const math = source.slice(i + 1, end);
        emit(opts.renderMath ? opts.renderMath(math, false) : renderBuiltInMath(math, false));
        i = end + 1;
        continue;
      }
    }
    const pairs: Array<[string, "strong" | "em" | "del"]> = [
      ["**", "strong"], ["__", "strong"], ["~~", "del"],
      ["*", "em"], ["_", "em"],
    ];
    let paired = false;
    for (const [marker, kind] of pairs) {
      if (!source.startsWith(marker, i)) continue;
      const end = source.indexOf(marker, i + marker.length);
      if (end <= i + marker.length) continue;
      const content = source.slice(i + marker.length, end);
      if (!content.trim() || /^\s|\s$/.test(content)) continue;
      const children = inline(content, opts, depth + 1);
      emit(kind === "strong" ? <strong>{children}</strong> : kind === "em" ? <em>{children}</em> : <del>{children}</del>);
      i = end + marker.length;
      paired = true;
      break;
    }
    if (paired) continue;
    plain += c;
    i++;
  }
  flush();
  return out;
}

const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const listItem = /^(\s*)([-+*]|\d+[.)])\s+(.*)$/;
const quote = /^\s{0,3}>\s?/;
const fence = /^\s{0,3}(\x60{3,}|~{3,})(.*)$/;
const horizontalRule = /^\s{0,3}(?:\*\s*){3,}$|^\s{0,3}(?:-\s*){3,}$|^\s{0,3}(?:_\s*){3,}$/;

function splitTableRow(row: string): string[] {
  const cells: string[] = [];
  let cell = "";
  const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (trimmed[i] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += trimmed[i];
    }
  }
  cells.push(cell.trim());
  return cells;
}
function tableAlign(row: string): Array<"left" | "center" | "right" | undefined> | null {
  if (!row.includes("|")) return null;
  const columns = splitTableRow(row);
  if (!columns.length || columns.some(c => !/^:?-{3,}:?$/.test(c))) return null;
  return columns.map(c => c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : c.startsWith(":") ? "left" : undefined);
}

function CodePanel({ code, language, highlightCode }: {
  code: string; language: string; highlightCode?: RenderOptions["highlightCode"];
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return <div className="hme-code-block">
    <div className="hme-code-header"><span className="hme-language">{language || "text"}</span>
      <button className="hme-code-copy" type="button" onClick={copy} aria-label="Copy code">{copied ? "Copied" : "Copy code"}</button>
    </div>
    <pre><code>{highlightCode ? highlightCode(code, language) : renderBuiltInHighlight(code, language)}</code></pre>
  </div>;
}

function renderList(lines: string[], start: number, opts: RenderOptions, depth = 0): { element: React.ReactNode; next: number } {
  const first = lines[start].match(listItem)!;
  const baseIndent = first[1].replace(/\t/g, "    ").length;
  const ordered = /^\d/.test(first[2]);
  const items: React.ReactNode[] = [];
  let i = start;
  while (i < lines.length) {
    const item = lines[i].match(listItem);
    if (!item) break;
    const indent = item[1].replace(/\t/g, "    ").length;
    if (indent !== baseIndent || /^\d/.test(item[2]) !== ordered) break;
    let content = item[3];
    const task = content.match(/^\[([ xX])\]\s+(.*)$/);
    if (task) content = task[2];
    i++;
    const nested: React.ReactNode[] = [];
    while (i < lines.length) {
      const next = lines[i].match(listItem);
      if (!next) {
        if (lines[i].trim() && /^\s+/.test(lines[i])) {
          content += " " + lines[i].trim();
          i++;
          continue;
        }
        break;
      }
      const nestedIndent = next[1].replace(/\t/g, "    ").length;
      if (nestedIndent <= baseIndent) break;
      if (depth >= 24) {
        // Preserve the source without recursively allocating unbounded React trees.
        nested.push(<span key={i}>{lines[i].trim()}</span>);
        i++;
      } else {
        const result = renderList(lines, i, opts, depth + 1);
        nested.push(<React.Fragment key={i}>{result.element}</React.Fragment>);
        i = result.next;
      }
    }
    items.push(<li key={items.length} className={task ? "hme-task" : undefined}>
      {task && <input type="checkbox" className="hme-checkbox" aria-label="Task completed" checked={task[1].toLowerCase() === "x"} readOnly />}
      {inline(content, opts)}{nested}
    </li>);
  }
  const element = ordered
    ? <ol start={Number.isSafeInteger(Number.parseInt(first[2], 10)) ? Number.parseInt(first[2], 10) : 1}>{items}</ol>
    : <ul>{items}</ul>;
  return { element, next: i };
}

function renderBlocks(lines: string[], opts: RenderOptions, depth = 0): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  const add = (node: React.ReactNode) => nodes.push(<React.Fragment key={nodes.length}>{node}</React.Fragment>);
  const special = (text: string): boolean =>
    Boolean(heading.test(text) || fence.test(text) || quote.test(text) || horizontalRule.test(text) || listItem.test(text) || text.trim().startsWith(String.fromCharCode(36, 36)) || text.trim().startsWith("\\["));
  while (i < lines.length) {
    const current = lines[i];
    if (!current.trim()) { i++; continue; }
    const openingFence = current.match(fence);
    if (openingFence) {
      const marker = openingFence[1];
      const language = openingFence[2].trim().split(/\s+/)[0].replace(/[^\w+#.-]/g, "");
      const source: string[] = [];
      i++;
      const closeFence = (candidate: string) => { const trimmed = candidate.trim(); return candidate.length - candidate.trimStart().length <= 3 && trimmed.length >= marker.length && Array.from(trimmed).every(char => char === marker[0]); };
      while (i < lines.length && !closeFence.test(lines[i])) {
        source.push(lines[i++]);
      }
      if (i < lines.length) i++;
      add(<CodePanel code={source.join("\n")} language={language} highlightCode={opts.highlightCode} />);
      continue;
    }
    const mathStart = current.trim().startsWith("$$") ? "$$" : current.trim().startsWith("\\[") ? "\\[" : null;
    if (mathStart) {
      const mathEnd = mathStart === String.fromCharCode(36, 36) ? String.fromCharCode(36, 36) : "\\]";
      let latex = current.trim().slice(mathStart.length);
      const closeOnOpeningLine = latex.indexOf(mathEnd);
      if (closeOnOpeningLine >= 0) {
        latex = latex.slice(0, closeOnOpeningLine);
        i++;
      } else {
        i++;
        const parts = [latex];
        while (i < lines.length && !lines[i].includes(mathEnd)) parts.push(lines[i++]);
        if (i < lines.length) {
          parts.push(lines[i].slice(0, lines[i].indexOf(mathEnd)));
          i++;
        }
        latex = parts.join("\n");
      }
      const content = latex.trim();
      add(<div className="hme-math-block">{opts.renderMath ? opts.renderMath(content, true) : renderBuiltInMath(content, true)}</div>);
      continue;
    }
    const head = current.match(heading);
    if (head) {
      const content = inline(head[2], opts);
      const level = head[1].length;
      add(React.createElement("h" + level, null, ...content));
      i++;
      continue;
    }
    if (horizontalRule.test(current)) { add(<hr />); i++; continue; }
    if (quote.test(current)) {
      const quoted: string[] = [];
      while (i < lines.length && quote.test(lines[i])) {
        quoted.push(lines[i++].replace(quote, ""));
      }
      add(<blockquote>{depth >= 24 ? <p>{quoted.join(" ")}</p> : renderBlocks(quoted, opts, depth + 1)}</blockquote>);
      continue;
    }
    if (listItem.test(current)) {
      const result = renderList(lines, i, opts);
      add(result.element);
      i = result.next;
      continue;
    }
    const aligns = i + 1 < lines.length ? tableAlign(lines[i + 1]) : null;
    if (aligns && splitTableRow(current).length === aligns.length) {
      const header = splitTableRow(current);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitTableRow(lines[i++]));
      }
      add(<div className="hme-table-wrap"><table>
        <thead><tr>{header.map((h, col) => <th key={col} style={{textAlign:aligns[col]}} scope="col">{inline(h, opts)}</th>)}</tr></thead>
        <tbody>{rows.map((r, n) => <tr key={n}>{header.map((_, col) => <td key={col} style={{textAlign:aligns[col]}}>{inline(r[col] || "", opts)}</td>)}</tr>)}</tbody>
      </table></div>);
      continue;
    }
    const paragraph = [current.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !special(lines[i]) && !tableAlign(lines[i + 1] || "")) {
      paragraph.push(lines[i++].trim());
    }
    add(<p>{inline(paragraph.join(" "), opts)}</p>);
  }
  return nodes;
}

export function ChatMarkdownRenderer({
  markdown,
  className,
  style,
  theme = "system",
  renderMath,
  highlightCode,
}: ChatMarkdownRendererProps) {
  const nodes = useMemo(
    () => renderBlocks(markdown.replace(/\r\n?/g, "\n").split("\n"), { renderMath, highlightCode }),
    [markdown, renderMath, highlightCode]
  );
  return <div className={["hme-chat-markdown", className].filter(Boolean).join(" ")} style={style} data-theme={theme}>
    <style data-hme-markdown-styles>{markdownCss}</style>
    {nodes}
  </div>;
}

export default ChatMarkdownRenderer;
