import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alignDisplayToSource, findMarkdownBlocks, HybridMarkdownEditor } from "./HybridMarkdownEditor";

const fence = "```";

function Controlled({ initial, widgets }: { initial: string; widgets?: boolean }) {
  const [value, setValue] = useState(initial);
  return <>
    <HybridMarkdownEditor value={value} onChange={setValue} chatMarkdownProps={{ widgets }} />
    <pre data-testid="value">{value}</pre>
  </>;
}

afterEach(() => vi.useRealTimers());

describe("hybrid rendering matches the renderer", () => {
  it("renders full inline formatting and heading styles on inactive lines", () => {
    const { container } = render(<HybridMarkdownEditor value={"# Title\nSome *em*, ~~del~~, `code` and [link](https://example.com)"} readOnly />);
    expect(container.querySelector(".hme-line-h1")?.textContent).toBe("Title");
    const source = container.querySelectorAll('[data-role="source-content"]')[1];
    expect(source.querySelector("em")?.textContent).toBe("em");
    expect(source.querySelector("del")?.textContent).toBe("del");
    expect(source.querySelector("code")?.textContent).toBe("code");
    expect(source.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
  });

  it("renders tables, fenced code and widget fences as blocks", () => {
    const value = ["| A | B |", "| --- | --- |", "| 1 | 2 |", "", fence + "ts", "const x = 1;", fence, "", fence + "flow", "One | 1", "Two | 2", fence].join("\n");
    const { container } = render(<HybridMarkdownEditor value={value} readOnly chatMarkdownProps={{ widgets: true }} />);
    expect(container.querySelectorAll(".hme-block")).toHaveLength(3);
    expect(container.querySelectorAll("table td")).toHaveLength(2);
    expect(container.querySelector(".hme-code-block pre code")?.textContent).toBe("const x = 1;");
    expect(container.querySelectorAll(".hme-flow-step")).toHaveLength(2);
    expect(container.textContent).not.toContain("| --- |");
  });

  it("opens the clicked table row for editing and shows the block source while editing", () => {
    const { container } = render(<Controlled initial={["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join("\n")} />);
    fireEvent.mouseUp(screen.getByText("3"));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("| 3 | 4 |");
    expect(container.querySelector(".hme-block")).toBeNull();
    expect(container.querySelectorAll(".hme-line-raw")).toHaveLength(4);
    fireEvent.change(textarea, { target: { value: "| 3 | 5 |" } });
    expect(screen.getByTestId("value").textContent).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 5 |");
  });

  it("lets links, copy buttons and widget inputs work without starting an edit", () => {
    const value = ["See [docs](https://example.com)", "", fence + "choice", "- A | First", "- B | Second", fence, "", fence + "js", "x()", fence].join("\n");
    render(<Controlled initial={value} widgets />);
    fireEvent.mouseUp(screen.getByRole("link", { name: "docs" }));
    fireEvent.mouseUp(screen.getByRole("button", { name: "Copy code" }));
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    fireEvent.mouseUp(screen.getByRole("radio", { name: "B" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("maps a click inside formatted text to the right source position", () => {
    expect(alignDisplayToSource("a **bold** [link](https://x.y) end", "a bold link end")).toEqual([0, 1, 4, 5, 6, 7, 10, 12, 13, 14, 15, 30, 31, 32, 33]);
    expect(alignDisplayToSource("$x^2$", "x2")).toEqual([1, 3]);
  });

  it("finds multi-line blocks without swallowing ordinary lines", () => {
    expect(findMarkdownBlocks(["intro", "", "Title", "-----", "text", "$$", "x", "$$", "a | b"])).toEqual([
      { start: 2, end: 3 },
      { start: 5, end: 7 },
    ]);
    // Indented code after a blank line is a block; indented list continuation is not.
    expect(findMarkdownBlocks(["intro", "", "    code()", "", "    more()", "", "after"])).toEqual([{ start: 2, end: 4 }]);
    expect(findMarkdownBlocks(["- item", "", "    continued"])).toEqual([]);
  });
});

describe("hybrid keyboard behaviour", () => {
  it("Escape leaves editing and focuses the editor; Enter resumes on the same line", () => {
    vi.useFakeTimers();
    const { container } = render(<Controlled initial={"first\nsecond"} />);
    fireEvent.mouseUp(screen.getByText("second"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    act(() => { vi.runAllTimers(); });
    const editor = container.querySelector(".hme-editor") as HTMLElement;
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(editor);
    expect(editor.tabIndex).toBe(0);
    expect(editor.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.keyDown(editor, { key: "Enter" });
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("second");
  });

  it("Tab on a plain line is not captured, so focus can leave the editor", () => {
    const { container } = render(<Controlled initial="plain" />);
    fireEvent.mouseUp(container.querySelector('[data-role="source-content"]')!);
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    screen.getByRole("textbox").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("Backspace at the start of a list line removes the marker before joining lines", () => {
    render(<Controlled initial={"- first\n- second"} />);
    fireEvent.mouseUp(screen.getByText("second"));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 0);
    fireEvent.select(textarea);
    fireEvent.keyDown(textarea, { key: "Backspace" });
    expect(screen.getByTestId("value").textContent).toBe("- first\nsecond");
    const again = screen.getByRole("textbox") as HTMLTextAreaElement;
    again.setSelectionRange(0, 0);
    fireEvent.select(again);
    fireEvent.keyDown(again, { key: "Backspace" });
    expect(screen.getByTestId("value").textContent).toBe("- firstsecond");
  });
});
