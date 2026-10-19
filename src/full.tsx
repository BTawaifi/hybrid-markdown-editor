import React from "react";
import { ChatMarkdownRenderer as CoreRenderer, type ChatMarkdownRendererProps } from "./ChatMarkdownRenderer";
import { HybridMarkdownEditor as CoreEditor, type HybridMarkdownEditorProps } from "./HybridMarkdownEditor";
import { builtInIntegrations } from "./MarkdownIntegrations";

/** Renderer with built-in KaTeX math and highlight.js code colouring. */
export function ChatMarkdownRenderer(props: ChatMarkdownRendererProps) {
  return <CoreRenderer {...props} builtIns={builtInIntegrations} />;
}

/** Editor with built-in KaTeX math and highlight.js code colouring. */
export function HybridMarkdownEditor(props: HybridMarkdownEditorProps) {
  return <CoreEditor {...props} builtIns={builtInIntegrations} />;
}
