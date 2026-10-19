import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as lite from "./lite";
import * as full from "./index";

const fence = "```";

describe("lite entry", () => {
  it("exports the same public API as the main entry", () => {
    expect(Object.keys(lite).sort()).toEqual(Object.keys(full).sort());
  });

  it("renders math as source and code as plain text without KaTeX or highlight.js", () => {
    const md = ["Inline $x^2$", "", "$$", "y=2", "$$", "", fence + "ts", "const a: number = 1;", fence, "", fence, "npm install", fence].join("\n");
    const { container } = render(<lite.ChatMarkdownRenderer markdown={md} />);
    expect(container.querySelector("math")).toBeNull();
    expect([...container.querySelectorAll(".hme-math-fallback")].map((e) => e.textContent)).toEqual(["x^2", "y=2"]);
    expect(container.querySelector(".hljs")).toBeNull();
    // Fence labels still work; unlabeled blocks are not guessed without highlight.js.
    expect([...container.querySelectorAll(".hme-language")].map((e) => e.textContent)).toEqual(["TypeScript", "Plain text"]);
  });

  it("uses caller-supplied math and highlighting hooks", () => {
    render(<lite.ChatMarkdownRenderer
      markdown={"$x$\n\n" + fence + "js\nlet a\n" + fence}
      renderMath={(latex) => <output data-testid="m">{latex}</output>}
      highlightCode={(code) => <output data-testid="c">{code}</output>}
    />);
    expect(screen.getByTestId("m").textContent).toBe("x");
    expect(screen.getByTestId("c").textContent).toBe("let a");
  });

  it("main entry keeps built-in KaTeX math and highlighting, also in the editor", () => {
    const md = "$x^2$\n\n" + fence + "ts\nconst a: number = 1;\n" + fence;
    const renderer = render(<full.ChatMarkdownRenderer markdown={md} />);
    expect(renderer.container.querySelector("math")).toBeTruthy();
    expect(renderer.container.querySelector(".hljs-keyword")).toBeTruthy();
    renderer.unmount();
    const editor = render(<full.HybridMarkdownEditor value={md} readOnly />);
    expect(editor.container.querySelector("math")).toBeTruthy();
    expect(editor.container.querySelector(".hljs-keyword")).toBeTruthy();
  });
});
