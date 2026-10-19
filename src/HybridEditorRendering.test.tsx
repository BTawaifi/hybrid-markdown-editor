import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alignDisplayToSource, findMarkdownBlocks } from "./HybridMarkdownEditor";
import { HybridMarkdownEditor } from "./index";
import { ChatMarkdownRenderer } from "./index";

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

  it("renders h5/h6, plus bullets, quotes, rules and one-line display math like the renderer", () => {
    const value = ["##### Five", "###### Six", "+ plus", "", "> quote", "> > nested", "", "***", "", "$$ x^2 $$"].join("\n");
    const { container } = render(<HybridMarkdownEditor value={value} readOnly />);
    expect(container.querySelector(".hme-line-h5")?.textContent).toBe("Five");
    expect(container.querySelector(".hme-line-h6")?.textContent).toBe("Six");
    expect(container.querySelector('[data-role="line-marker"]')?.textContent).toBe("•");
    expect(container.querySelectorAll("blockquote blockquote")).toHaveLength(1);
    expect(container.querySelectorAll("hr")).toHaveLength(1);
    expect(container.querySelectorAll(".hme-math-block math")).toHaveLength(1);
    expect(container.textContent).not.toMatch(/#####|> >|\*\*\*|\$\$/);
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
    // A paragraph glued to an underline is one heading block, never a rule (CommonMark).
    expect(findMarkdownBlocks(["one", "two", "-----", "", "***"])).toEqual([{ start: 0, end: 2 }, { start: 4, end: 4 }]);
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

describe("task checkboxes", () => {
  it("toggles task markers, widget rows and preview checkboxes in the source", () => {
    const value = ["- [ ] write", "", fence + "checklist", "title: Packing", "- [ ] Tent | 1", fence].join("\n");
    const { container } = render(<Controlled initial={value} widgets />);
    fireEvent.click(container.querySelector('[data-role="line-marker"] input')!);
    expect(screen.getByTestId("value").textContent).toContain("- [x] write");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(container.querySelector(".hme-w-check")!);
    expect(screen.getByTestId("value").textContent).toContain("- [x] Tent | 1");
    expect(container.querySelector(".hme-w-count")?.textContent).toBe("1/1");
  });

  it("toggles source from preview mode and ignores toggles when read-only", () => {
    function Preview({ readOnly }: { readOnly?: boolean }) {
      const [value, setValue] = useState("> - [ ] quoted task");
      return <><HybridMarkdownEditor value={value} onChange={setValue} presentation="preview" readOnly={readOnly} /><pre data-testid="v">{value}</pre></>;
    }
    const view = render(<Preview />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Task completed" }));
    expect(screen.getByTestId("v").textContent).toBe("> - [x] quoted task");
    view.unmount();
    render(<Preview readOnly />);
    const box = screen.getByRole("checkbox", { name: "Task completed" }) as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(false);
    expect(screen.getByTestId("v").textContent).toBe("> - [ ] quoted task");
  });
});

describe("inline renderer fixes found by the kitchen-sink pass", () => {
  it("closes emphasis inside asterisk runs, links bare URLs, keeps snake_case literal", () => {
    const md = "***both*** and **bold *inner*** then https://bare.example.com/x. and my_var_name and _em_";
    const { container } = render(<HybridMarkdownEditor value={md} readOnly />);
    const source = container.querySelector('[data-role="source-content"]')!;
    expect(source.textContent).toBe("both and bold inner then https://bare.example.com/x. and my_var_name and em");
    expect(source.querySelector("strong em")?.textContent).toBe("both");
    expect(source.querySelectorAll("strong")[1].querySelector("em")?.textContent).toBe("inner");
    expect(source.querySelector("a")?.getAttribute("href")).toBe("https://bare.example.com/x");
    expect(source.querySelectorAll("em")).toHaveLength(3);
  });

  it("gives heading lines heading semantics and indents continuation lines", () => {
    const { container } = render(<HybridMarkdownEditor value={"## Section\n- item\n\n  continued"} readOnly />);
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeTruthy();
    const previews = container.querySelectorAll('[data-role="line-preview"]');
    expect((previews[3] as HTMLElement).style.paddingLeft).toBe("16px");
  });
});

describe("undo and redo", () => {
  const typeInto = (textarea: HTMLTextAreaElement, value: string) => fireEvent.change(textarea, { target: { value } });

  it("merges rapid typing into one step and undoes/redoes structural edits", () => {
    render(<Controlled initial={"first\nsecond"} />);
    fireEvent.mouseUp(screen.getAllByText("second")[0]);
    let textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    typeInto(textarea, "second!");
    typeInto(textarea, "second!!");
    textarea.setSelectionRange(0, 0);
    fireEvent.select(textarea);
    fireEvent.keyDown(textarea, { key: "Backspace" }); // join with "first"
    expect(screen.getByTestId("value").textContent).toBe("firstsecond!!");

    textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: "z", ctrlKey: true });
    expect(screen.getByTestId("value").textContent).toBe("first\nsecond!!");
    textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: "z", ctrlKey: true }); // both keystrokes are one step
    expect(screen.getByTestId("value").textContent).toBe("first\nsecond");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("second");

    textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: "z", ctrlKey: true, shiftKey: true });
    expect(screen.getByTestId("value").textContent).toBe("first\nsecond!!");
    textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: "y", ctrlKey: true });
    expect(screen.getByTestId("value").textContent).toBe("firstsecond!!");
  });

  it("undoes task toggles and clears history when the value is replaced from outside", () => {
    function Outer() {
      const [value, setValue] = useState("- [ ] task");
      return <>
        <HybridMarkdownEditor value={value} onChange={setValue} />
        <button type="button" onClick={() => setValue("replaced")}>replace</button>
        <pre data-testid="v">{value}</pre>
      </>;
    }
    const { container } = render(<Outer />);
    fireEvent.click(container.querySelector('[data-role="line-marker"] input')!);
    expect(screen.getByTestId("v").textContent).toBe("- [x] task");
    const editor = container.querySelector(".hme-editor") as HTMLElement;
    fireEvent.keyDown(editor, { key: "z", metaKey: true });
    expect(screen.getByTestId("v").textContent).toBe("- [ ] task");
    fireEvent.click(screen.getByText("replace"));
    fireEvent.keyDown(container.querySelector(".hme-editor") as HTMLElement, { key: "z", ctrlKey: true });
    expect(screen.getByTestId("v").textContent).toBe("replaced");
  });
});

describe("GitHub alerts", () => {
  it("render as titled alerts in the renderer and in hybrid mode", () => {
    const md = ["> [!WARNING]", "> Back up **first**.", "", "> [!tip]", "> Small tip.", "", "> Plain quote"].join(String.fromCharCode(10));
    const renderer = render(<ChatMarkdownRenderer markdown={md} />);
    const alerts = renderer.container.querySelectorAll(".hme-alert");
    expect([...alerts].map(a => a.className)).toEqual(["hme-alert is-warning", "hme-alert is-tip"]);
    expect(alerts[0].querySelector(".hme-alert-title")?.textContent).toBe("Warning");
    expect(alerts[0].querySelector("strong")?.textContent).toBe("first");
    expect(renderer.container.querySelectorAll("blockquote")).toHaveLength(1);
    renderer.unmount();
    const hybrid = render(<HybridMarkdownEditor value={md} readOnly />);
    expect(hybrid.container.querySelectorAll(".hme-alert")).toHaveLength(2);
    expect(hybrid.container.textContent).not.toContain("[!WARNING]");
  });
});
