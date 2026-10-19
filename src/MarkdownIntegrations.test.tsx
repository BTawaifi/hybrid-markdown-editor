import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdownRenderer } from "./ChatMarkdownRenderer";
import { codeLanguageLabel, detectCodeLanguage } from "./MarkdownIntegrations";

describe("built-in typesetting and highlighting", () => {
  it("typesets inline and display LaTeX using KaTeX MathML without custom hooks", () => {
    const markdown = String.raw`Inline $x^2$ and \(a+b\).

$$
\frac{1}{2}
$$

\[
\sqrt{5}
\]`;
    const { container } = render(<ChatMarkdownRenderer markdown={markdown} />);
    const math = container.querySelectorAll("math");
    expect(math.length).toBe(4);
    expect(math[0].textContent).toContain("x");
    expect(container.querySelectorAll(".hme-math-block")).toHaveLength(2);
    expect(container.querySelectorAll(".hme-math-typeset")).toHaveLength(4);
  });

  it("colors known languages and leaves unrecognized languages readable", () => {
    const tick = String.fromCharCode(96).repeat(3);
    const content = [
      tick + "typescript", "const value: number = 3;", tick,
      "", tick + "mysterylang", "hello <world>", tick,
    ].join("\n");
    const { container } = render(<ChatMarkdownRenderer markdown={content} theme="dark" />);
    expect(container.querySelector(".hme-chat-markdown")?.getAttribute("data-theme")).toBe("dark");
    const blocks = container.querySelectorAll("pre code");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].textContent).toContain("const value");
    expect(blocks[0].querySelector(".hljs-keyword")).toBeTruthy();
    expect(blocks[1].textContent).toBe("hello <world>");
    expect(blocks[1].querySelector(".hljs")).toBeNull();
  });

  it("detects unlabeled code languages and keeps weak guesses as plain text", () => {
    expect(detectCodeLanguage("npx create-next-app@latest taskflow\ncd taskflow")).toBe("bash");
    expect(detectCodeLanguage("SELECT id FROM tasks;")).toBe("sql");
    expect(detectCodeLanguage("export default async function Page() {\n  const tasks = await getTasks();\n  return <ul>{tasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;\n}")).toBe("typescript");
    expect(detectCodeLanguage("taskflow/\n├── app/\n│   └── page.tsx\n└── package.json")).toBe("");
    expect(codeLanguageLabel("")).toBe("Plain text");
    expect(codeLanguageLabel("tsx")).toBe("TSX");
    expect(codeLanguageLabel("ts")).toBe("TypeScript");
  });

  it("escapes hostile code and keeps KaTeX trust disabled", () => {
    const tick = String.fromCharCode(96).repeat(3);
    const source = '<script>alert("x")</script><img src=x onerror=alert(1)>';
    const markdown = tick + "html\n" + source + "\n" + tick + "\n\n$\\href{javascript:alert(1)}{click}$";
    const { container } = render(<ChatMarkdownRenderer markdown={markdown} />);
    expect(container.querySelectorAll("script, img, iframe")).toHaveLength(0);
    expect(container.querySelector("pre code")?.textContent).toBe(source);
    expect(container.querySelectorAll("a[href^='javascript:']")).toHaveLength(0);
    expect(container.querySelector("math")).toBeTruthy();
  });

  it("uses custom renderer hooks when provided", () => {
    const tick = String.fromCharCode(96).repeat(3);
    const markdown = "$x$" + "\n\n" + tick + "javascript\nlet a=1\n" + tick;
    render(
      <ChatMarkdownRenderer
        markdown={markdown}
        renderMath={(latex) => <output data-testid="custom-math">{latex}</output>}
        highlightCode={(source) => <output data-testid="custom-code">{source}</output>}
      />
    );
    expect(screen.getByTestId("custom-math").textContent).toBe("x");
    expect(screen.getByTestId("custom-code").textContent).toBe("let a=1");
  });
});
