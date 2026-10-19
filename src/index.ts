// Main entry: components with built-in KaTeX math and highlight.js code colouring.
export { HybridMarkdownEditor, ChatMarkdownRenderer } from "./full";
export { parseBold, mapDisplayOffsetToSourceIndex } from "./HybridMarkdownEditor";

export type {
  EditorExtension,
  ExtensionApi,
  HybridMarkdownEditorProps,
} from "./HybridMarkdownEditor";
export type { ChatMarkdownRendererProps } from "./ChatMarkdownRenderer";
