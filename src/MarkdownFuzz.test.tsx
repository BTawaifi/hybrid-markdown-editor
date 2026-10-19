import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatMarkdownRenderer } from "./ChatMarkdownRenderer";
import { HybridMarkdownEditor, mapDisplayOffsetToSourceIndex } from "./HybridMarkdownEditor";

// Fixed-seed fuzz cases are deterministic in CI and reproducible locally.
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const tokens = [
  "*", "**", "***", "_", "~~", "$", "?", "[", "]", "(", ")", "!",
  "<", ">", "/", "\\", String.fromCharCode(96), "&", "#", ":", "\n", " ", "\t",
  "a", "9", "https://example.com", "javascript:", "data:", "🥇",
  "<img src=x onerror=alert(1)>", "\u202e", "https:\\\\evil.example",
];

describe("deterministic adversarial Markdown fuzzing", () => {
  it("renders 220 seeded malformed documents deterministically without executable elements", () => {
    const rand = generator(0xdecafbad);
    for (let sample = 0; sample < 220; sample++) {
      let markdown = "";
      for (let i = 0; i < 70; i++) {
        markdown += tokens[Math.floor(rand() * tokens.length)];
      }
      const output = renderToStaticMarkup(<ChatMarkdownRenderer markdown={markdown} />);
      const duplicate = renderToStaticMarkup(<ChatMarkdownRenderer markdown={markdown} />);
      expect(output, "unstable rendering at sample " + sample).toBe(duplicate);
      expect(output.length, "output blow-up at sample " + sample).toBeLessThan(180000);
      const container = document.createElement("div");
      container.innerHTML = output;
      expect(container.querySelectorAll("script, iframe, [onerror], [onclick]")).toHaveLength(0);
      expect(container.querySelectorAll('a[href^="javascript:"], a[href^="data:"]')).toHaveLength(0);
    }
  });

  it("keeps source offsets within bounds and monotonic for malformed lines", () => {
    const rand = generator(0x11ab31fe);
    for (let sample = 0; sample < 180; sample++) {
      let line = "";
      for (let i = 0; i < 60; i++) {
        line += tokens[Math.floor(rand() * tokens.length)].replace(/\n/g, "");
      }
      let previous = -1;
      const offsets = new Set([0, 1, 2, line.length, line.length + 2]);
      for (let probe = 0; probe < 18; probe++) offsets.add(Math.floor(rand() * (line.length + 3)));
      for (const offset of Array.from(offsets).sort((a, b) => a - b)) {
        const index = mapDisplayOffsetToSourceIndex(line, offset);
        expect(index, "out of bounds at sample " + sample).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThanOrEqual(line.length);
        expect(index, "mapping reversal at sample " + sample).toBeGreaterThanOrEqual(previous);
        previous = index;
      }
    }
  });

  it("preserves the controlled change contract across 60 seeded edit operations", () => {
    const rand = generator(0xba11cafe);
    for (let sample = 0; sample < 60; sample++) {
      const left = "left" + Math.floor(rand() * 1000000);
      const right = "right" + Math.floor(rand() * 1000000);
      const split = sample % 2 === 0;
      const value = split ? left + right : left + "\n" + right;
      const caret = Math.floor(rand() * (left.length + 1));
      let observed: string | undefined;
      function Harness() {
        const [markdown, setMarkdown] = useState(value);
        return <HybridMarkdownEditor value={markdown} onChange={(next) => { observed = next; setMarkdown(next); }} />;
      }
      const view = render(<Harness />);
      const label = split ? left + right : right;
      fireEvent.mouseUp(screen.getByText(label));
      const input = screen.getByRole("textbox") as HTMLTextAreaElement;
      const offset = split ? caret : 0;
      input.setSelectionRange(offset, offset);
      fireEvent.select(input);
      fireEvent.keyDown(input, { key: split ? "Enter" : "Backspace" });
      const expected = split
        ? value.slice(0, offset) + "\n" + value.slice(offset)
        : left + right;
      expect(observed, "edit mismatch in seeded case " + sample).toBe(expected);
      view.unmount();
      cleanup();
    }
  });

  it("bounds invalid cursor offsets instead of leaking undefined indexes", () => {
    const line = "**bold** example";
    for (const offset of [NaN, Infinity, -Infinity]) {
      const value = mapDisplayOffsetToSourceIndex(line, offset);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(line.length);
    }
  });

  it("preserves display math containing a single dollar and following text", () => {
    const markdown = [
      "$$", "a + $b$ + c", "$$", "",
      "After math.", "",
      "\\[", "x + y", "\\]", "", "End.",
    ].join("\n");
    const markup = renderToStaticMarkup(<ChatMarkdownRenderer markdown={markdown} />);
    expect(markup).toContain('data-math-latex="a + $b$ + c"');
    expect(markup).toContain('data-math-latex="x + y"');
    expect(markup).toContain("After math.");
    expect(markup).toContain("End.");
  });

  it("rejects backslash-network, data, and script URLs", () => {
    const markdown = [
      "[bad](\\\\evil.example/path)",
      "[bad](javascript:alert)",
      "[bad](data:text/html,hello)",
      "![bad](\\\\evil.example/pic)",
      "[good](https://example.com/page)",
    ].join("\n\n");
    const html = renderToStaticMarkup(<ChatMarkdownRenderer markdown={markdown} />);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="https://example.com/page"');
    expect(html).not.toMatch(/<img/);
  });

  it("bounds deeply nested quote/list trees", () => {
    const quotes = Array.from({ length: 90 }, (_, i) => ">".repeat(i + 1) + " level " + i).join("\n");
    const lists = Array.from({ length: 100 }, (_, i) => " ".repeat(i) + "- item " + i).join("\n");
    expect(() => renderToStaticMarkup(<ChatMarkdownRenderer markdown={quotes} />)).not.toThrow();
    expect(() => renderToStaticMarkup(<ChatMarkdownRenderer markdown={lists} />)).not.toThrow();
  });

  it("preserves long unmatched delimiters without runaway work", () => {
    const markdown = "*".repeat(26000) + "[".repeat(26000);
    const output = renderToStaticMarkup(<ChatMarkdownRenderer markdown={markdown} />);
    expect(output.length).toBeGreaterThan(markdown.length);
    expect(output).toContain("[".repeat(100));
  });

  it("does not highlight oversized code fences synchronously", () => {
    const marker = String.fromCharCode(96).repeat(3);
    const code = "const x = 1;".repeat(10000);
    const html = renderToStaticMarkup(<ChatMarkdownRenderer markdown={marker + "typescript\n" + code + "\n" + marker} />);
    expect(html).toContain("const x = 1;");
    const container = document.createElement("div");
    container.innerHTML = html;
    expect(container.querySelector("pre code .hljs-keyword")).toBeNull();
  });
});
