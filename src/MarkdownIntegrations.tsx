import React from "react";
import katex from "katex";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

// Register a deliberate, small language set rather than loading every grammar.
const grammars = {
  bash, css, diff, go, javascript, json, markdown, python, rust,
  sql, typescript, xml, yaml,
};
Object.entries(grammars).forEach(([name, grammar]) => {
  hljs.registerLanguage(name, grammar);
});

const aliases: Record<string, keyof typeof grammars> = {
  cjs: "javascript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  html: "xml",
  svg: "xml",
  md: "markdown",
  yml: "yaml",
  rs: "rust",
  golang: "go",
};

/**
 * KaTeX's native MathML output does not need a separate stylesheet or
 * downloadable webfonts. KaTeX generates the markup with trust disabled,
 * limiting input-driven HTML commands and links.
 */
export function renderBuiltInMath(latex: string, display: boolean): React.ReactNode {
  try {
    const markup = katex.renderToString(latex, {
      displayMode: display,
      output: "mathml",
      trust: false,
      throwOnError: false,
      strict: "warn",
      maxExpand: 1000,
      maxSize: 10,
    });
    return <span
      className={display ? "hme-math-typeset hme-math-display" : "hme-math-typeset"}
      data-math-latex={latex}
      dangerouslySetInnerHTML={{ __html: markup }}
    />;
  } catch {
    // Malformed input never crashes the surrounding Markdown document.
    return <span className="hme-math-fallback">{latex}</span>;
  }
}

/**
 * highlight.js escapes source tokens before producing highlighted markup.
 * Unknown languages return React text instead of injecting untrusted HTML.
 */
export function renderBuiltInHighlight(code: string, language: string): React.ReactNode {
  const label = language.toLowerCase();
  const grammar = aliases[label] ?? label;
  if (!Object.prototype.hasOwnProperty.call(grammars, grammar)) return code;

  try {
    const html = hljs.highlight(code, { language: grammar, ignoreIllegals: true }).value;
    return <span className="hljs" dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return code;
  }
}
