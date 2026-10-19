// Language names for code block headers. Dependency-free so the lite entry can use it.

/** Common fence tags mapped to the grammar names used for highlighting and labels. */
export const languageAliases: Record<string, string> = {
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

const displayNames: Record<string, string> = {
  bash: "Bash", css: "CSS", diff: "Diff", go: "Go", javascript: "JavaScript", json: "JSON",
  markdown: "Markdown", python: "Python", rust: "Rust", sql: "SQL", typescript: "TypeScript",
  xml: "HTML", yaml: "YAML", jsx: "JSX", tsx: "TSX", html: "HTML", svg: "SVG", sh: "Shell",
};

/** Human-readable language name for a code block header, as chat UIs show it. */
export function codeLanguageLabel(language: string): string {
  const key = language.toLowerCase();
  if (!key || key === "text" || key === "plaintext") return "Plain text";
  return displayNames[key] ?? displayNames[languageAliases[key] ?? ""] ?? language;
}
