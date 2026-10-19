// Lite entry: same components without KaTeX or highlight.js (much smaller bundle).
// Math shows as its source and code as plain text unless you pass renderMath / highlightCode.
export { HybridMarkdownEditor, parseBold, mapDisplayOffsetToSourceIndex } from "./HybridMarkdownEditor";
export { ChatMarkdownRenderer } from "./ChatMarkdownRenderer";

export type {
  EditorExtension,
  ExtensionApi,
  HybridMarkdownEditorProps,
} from "./HybridMarkdownEditor";
export type { ChatMarkdownRendererProps } from "./ChatMarkdownRenderer";
