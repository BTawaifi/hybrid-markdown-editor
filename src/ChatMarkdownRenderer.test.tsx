import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatMarkdownRenderer } from "./index";
import { HybridMarkdownEditor } from "./index";

describe("ChatMarkdownRenderer", () => {
  it("renders headings, inline formatting, safe links and images", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={"# Title\n\nSome **bold**, *italic*, ~~deleted~~ and \x60code\x60.\n\n[Link](https://example.com) ![Alt](/photo.png)"} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Title");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
    expect(container.querySelector("del")?.textContent).toBe("deleted");
    expect(container.querySelector("code")?.textContent).toBe("code");
    expect(screen.getByRole("link", { name: "Link" }).getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("img", { name: "Alt" }).getAttribute("src")).toBe("/photo.png");
  });

  it("renders GFM tables with column alignment", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={"| Item | Qty |\n| :--- | ---: |\n| Pens | 3 |"} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Qty" }).getAttribute("style")).toContain("right");
    expect(container.querySelectorAll("td").length).toBe(2);
  });

  it("renders nested lists and task checkboxes", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={"- parent\n  - child\n- [x] done\n- [ ] todo"} />);
    expect(container.querySelector("li li")?.textContent).toContain("child");
    expect(container.querySelectorAll("input[type='checkbox']").length).toBe(2);
    expect((container.querySelector("input[type='checkbox']") as HTMLInputElement).checked).toBe(true);
  });

  it("renders fenced code with language and copy control", () => {
    const markdown = "&#96;&#96;&#96;typescript\nconst n = 42;\n&#96;&#96;&#96;".split("&#96;").join(String.fromCharCode(96));
    const { container } = render(<ChatMarkdownRenderer markdown={markdown} />);
    expect(container.querySelector(".hme-language")?.textContent).toBe("TypeScript");
    expect(container.querySelector("pre code")?.textContent).toBe("const n = 42;");
    expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();
  });

  it("renders setext headings, including over a thematic-break-like underline", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={"Big Title\n=========\n\nPart\n----\n\ntext\n\n---"} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Big Title");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Part");
    expect(container.querySelectorAll("hr").length).toBe(1);
  });

  it("keeps loose lists (blank lines between items) as one list", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={"1. one\n\n2. two\n\n   more of two\n\n3. three\n\n- a\n\n- b"} />);
    expect(container.querySelectorAll("ol").length).toBe(1);
    expect(container.querySelectorAll("ol > li").length).toBe(3);
    expect(container.querySelectorAll("ol > li")[1].textContent).toBe("two more of two");
    expect(container.querySelectorAll("ul > li").length).toBe(2);
  });

  it("renders indented code blocks with a detected language label", () => {
    const code = "    export default async function Page() {\n      const tasks = await getTasks();\n      return tasks.map((t: Task) => t.title);\n    }";
    const { container } = render(<ChatMarkdownRenderer markdown={"Intro:\n\n" + code + "\n\nAfter\n    lazy continuation"} />);
    expect(container.querySelector("pre code")?.textContent).toContain("export default async function Page() {\n  const tasks");
    expect(container.querySelector(".hme-language")?.textContent).not.toBe("Plain text");
    expect(container.querySelectorAll("pre").length).toBe(1);
    expect(container.querySelector("p:last-of-type")?.textContent).toBe("After lazy continuation");
  });

  it("renders images with empty alt text but not label-less links", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={"![](/icon.png) [](https://example.com)"} />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders blockquotes and horizontal rules", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={"> quoted **text**\n\n---"} />);
    expect(container.querySelector("blockquote strong")?.textContent).toBe("text");
    expect(container.querySelector("hr")).toBeTruthy();
  });

  it("does not render raw HTML or javascript links", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={'<script>alert(1)</script> [unsafe](javascript:alert(1)) ![bad](data:image/svg+xml,test)'} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });

  it("supports optional math rendering and code highlighting hooks", () => {
    const renderMath = vi.fn((latex: string) => <span data-testid="math">{latex}</span>);
    const highlightCode = vi.fn((source: string) => <strong>{source}</strong>);
    const markdown = "$x^2$\n\n$$\ny=2\n$$\n\n" + String.fromCharCode(96).repeat(3) + "js\n42\n" + String.fromCharCode(96).repeat(3);
    const { container } = render(<ChatMarkdownRenderer markdown={markdown} renderMath={renderMath} highlightCode={highlightCode} />);
    expect(screen.getAllByTestId("math").length).toBe(2);
    expect(renderMath).toHaveBeenCalledWith("x^2", false);
    expect(renderMath).toHaveBeenCalledWith("y=2", true);
    expect(container.querySelector("pre strong")?.textContent).toBe("42");
  });
});

describe("HybridMarkdownEditor preview presentation", () => {
  it("preserves the controlled editing contract when switching preview and edit", () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("# Heading\n\nFirst paragraph");
      return <HybridMarkdownEditor presentation="preview" value={value} onChange={(next) => { onChange(next); setValue(next); }} />;
    }
    render(<Harness />);
    expect(screen.getByRole("heading", { level: 1, name: "Heading" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit Markdown" }));
    const textbox = screen.getByRole("textbox", { name: "Markdown line 1" });
    fireEvent.change(textbox, { target: { value: "# Changed" } });
    expect(onChange).toHaveBeenCalledWith("# Changed\n\nFirst paragraph");
    fireEvent.click(screen.getByRole("button", { name: "Preview Markdown" }));
    expect(screen.getByRole("heading", { level: 1, name: "Changed" })).toBeTruthy();
  });

  it("renders in readOnly preview mode without editing controls", () => {
    render(<HybridMarkdownEditor value="# Read only" readOnly presentation="preview" />);
    expect(screen.getByRole("heading", { name: "Read only" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit Markdown" })).toBeNull();
  });
});
