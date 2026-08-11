import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EditorExtension,
  HybridMarkdownEditor,
  mapDisplayOffsetToSourceIndex,
  parseBold,
} from "./HybridMarkdownEditor";

const activateLine = (text: string) => {
  fireEvent.mouseUp(screen.getByText(text));
};

const setCaret = (textarea: HTMLTextAreaElement, start: number, end = start) => {
  textarea.setSelectionRange(start, end);
  fireEvent.select(textarea);
};

describe("HybridMarkdownEditor editing contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("emits onChange for ordinary typing", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="hello" onChange={onChange} />);
    activateLine("hello");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello!" } });
    expect(onChange).toHaveBeenLastCalledWith("hello!");
  });

  it("emits onChange when Enter splits a line", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="hello world" onChange={onChange} />);
    activateLine("hello world");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 5);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("hello\n world");
    expect(screen.getByLabelText("Markdown line 2")).toBeTruthy();
  });

  it("Enter replaces the active textarea selection", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="hello WORLD goodbye" onChange={onChange} />);
    activateLine("hello WORLD goodbye");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 6, 11);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("hello \n goodbye");
  });

  it("continues ordered list numbering on Enter", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="3. item" onChange={onChange} />);
    activateLine("item");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, textarea.value.length);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("3. item\n4. ");
  });

  it("continues tasks as unchecked items", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="- [x] done" onChange={onChange} />);
    activateLine("done");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, textarea.value.length);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("- [x] done\n- [ ] ");
  });

  it("exits an empty list item instead of creating another marker", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="- " onChange={onChange} />);
    const preview = document.querySelector('[data-role="line-preview"]') as HTMLElement;
    fireEvent.mouseUp(preview);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, textarea.value.length);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("can disable list continuation on Enter", () => {
    const onChange = vi.fn();
    render(
      <HybridMarkdownEditor
        value="- item"
        onChange={onChange}
        options={{ continueListsOnEnter: false }}
      />
    );
    activateLine("item");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, textarea.value.length);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("- item\n");
  });

  it("emits onChange when Backspace merges lines", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value={"first\nsecond"} onChange={onChange} />);
    activateLine("second");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 0);
    fireEvent.keyDown(textarea, { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith("firstsecond");
  });

  it("removes a list marker before deleting list content", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="- item" onChange={onChange} />);
    activateLine("item");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 2);
    fireEvent.keyDown(textarea, { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith("item");
  });

  it("indents and dedents list items through the same change pipeline", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="- item" onChange={onChange} options={{ indentSize: 2 }} />);
    activateLine("item");
    let textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 2);
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(onChange).toHaveBeenLastCalledWith("  - item");

    textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 4);
    fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith("- item");
  });

  it("dedents a tab-indented list item", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value={"\t- item"} onChange={onChange} />);
    activateLine("item");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 1);
    fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith("- item");
  });

  it("multi-line paste replaces the selected text", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="hello WORLD goodbye" onChange={onChange} />);
    activateLine("hello WORLD goodbye");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 6, 11);
    fireEvent.paste(textarea, {
      clipboardData: { getData: () => "foo\nbar" },
    });
    expect(onChange).toHaveBeenLastCalledWith("hello foo\nbar goodbye");
    expect(screen.getByLabelText("Markdown line 2")).toBeTruthy();
  });

  it("leaves single-line paste to native textarea handling", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="hello" onChange={onChange} />);
    activateLine("hello");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const allowed = fireEvent.paste(textarea, { clipboardData: { getData: () => "x" } });
    expect(allowed).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("extension setLine emits onChange", () => {
    const onChange = vi.fn();
    const extension: EditorExtension = {
      onKeyDown: (event, api) => {
        if (event.key !== "F2") return;
        api.setLine(0, "changed by extension");
        event.preventDefault();
        return true;
      },
    };
    render(<HybridMarkdownEditor value="original" onChange={onChange} extensions={[extension]} />);
    activateLine("original");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "F2" });
    expect(onChange).toHaveBeenLastCalledWith("changed by extension");
  });

  it("extension insertLine/deleteLines/setValue all emit changes", () => {
    const onChange = vi.fn();
    let capturedApi: Parameters<NonNullable<EditorExtension["onKeyDown"]>>[1] | null = null;
    const extension: EditorExtension = {
      onKeyDown: (_event, api) => {
        capturedApi = api;
        return true;
      },
    };
    render(<HybridMarkdownEditor value={"a\nb"} onChange={onChange} extensions={[extension]} />);
    activateLine("a");
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "F2" });
    expect(capturedApi).not.toBeNull();

    act(() => capturedApi!.insertLine(1, "x"));
    expect(onChange).toHaveBeenLastCalledWith("a\nx\nb");
    act(() => capturedApi!.deleteLines(0, 2));
    expect(onChange).toHaveBeenLastCalledWith("b");
    act(() => capturedApi!.setValue("final"));
    expect(onChange).toHaveBeenLastCalledWith("final");
  });

  it("deletes a same-line rendered selection and emits onChange", () => {
    const onChange = vi.fn();
    const { container } = render(<HybridMarkdownEditor value="hello" onChange={onChange} />);
    const source = container.querySelector('[data-role="source-content"]') as HTMLElement;
    const text = source.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 4);
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onChange).toHaveBeenLastCalledWith("ho");
  });

  it("deletes a rendered selection across lines and merges the boundaries", () => {
    const onChange = vi.fn();
    const { container } = render(<HybridMarkdownEditor value={"alpha\nbeta\ngamma"} onChange={onChange} />);
    const sources = container.querySelectorAll('[data-role="source-content"]');
    const first = sources[0].firstChild as Text;
    const last = sources[2].firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(first, 2);
    range.setEnd(last, 2);
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith("almma");
  });

  it("does not delete rendered selections in readOnly mode", () => {
    const onChange = vi.fn();
    const { container } = render(<HybridMarkdownEditor value="locked" onChange={onChange} readOnly />);
    const source = container.querySelector('[data-role="source-content"]') as HTMLElement;
    const text = source.firstChild as Text;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 3);
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("locked")).toBeTruthy();
  });

  it("does not activate or edit in readOnly mode", () => {
    const onChange = vi.fn();
    render(<HybridMarkdownEditor value="locked" onChange={onChange} readOnly />);
    activateLine("locked");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("immediately exits edit mode when readOnly becomes true", () => {
    const { rerender } = render(<HybridMarkdownEditor value="editable" />);
    activateLine("editable");
    expect(screen.getByRole("textbox")).toBeTruthy();
    rerender(<HybridMarkdownEditor value="editable" readOnly />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("debounces the latest controlled value without being cancelled by parent echoes", () => {
    const onDebouncedChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = useState("hello");
      return (
        <HybridMarkdownEditor
          value={value}
          onChange={setValue}
          onDebouncedChange={onDebouncedChange}
          debounceMs={300}
        />
      );
    };
    render(<Harness />);
    activateLine("hello");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello!" } });
    act(() => vi.advanceTimersByTime(299));
    expect(onDebouncedChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDebouncedChange).toHaveBeenCalledTimes(1);
    expect(onDebouncedChange).toHaveBeenCalledWith("hello!");
  });

  it("resets the debounce timer and emits only the latest edit", () => {
    const onDebouncedChange = vi.fn();
    render(<HybridMarkdownEditor value="a" onDebouncedChange={onDebouncedChange} debounceMs={200} />);
    activateLine("a");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "ab" } });
    act(() => vi.advanceTimersByTime(150));
    fireEvent.change(textarea, { target: { value: "abc" } });
    act(() => vi.advanceTimersByTime(199));
    expect(onDebouncedChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDebouncedChange).toHaveBeenCalledTimes(1);
    expect(onDebouncedChange).toHaveBeenLastCalledWith("abc");
  });

  it("cancels a pending local debounce when an unrelated external value replaces the document", () => {
    const onDebouncedChange = vi.fn();
    const { rerender } = render(
      <HybridMarkdownEditor value="local" onDebouncedChange={onDebouncedChange} debounceMs={100} />
    );
    activateLine("local");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "local edit" } });
    rerender(<HybridMarkdownEditor value="server value" onDebouncedChange={onDebouncedChange} debounceMs={100} />);
    act(() => vi.advanceTimersByTime(100));
    expect(onDebouncedChange).not.toHaveBeenCalled();
    expect(screen.getByText("server value")).toBeTruthy();
  });

  it("does not refocus/scroll on every character change", () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    render(<HybridMarkdownEditor value="hello" />);
    activateLine("hello");
    const callsAfterActivation = scrollSpy.mock.calls.length;
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello!" } });
    expect(scrollSpy.mock.calls.length).toBe(callsAfterActivation);
  });

  it("keeps ArrowUp native when caret is in the middle of a line", () => {
    render(<HybridMarkdownEditor value={"first\nsecond"} />);
    activateLine("second");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 3);
    const allowed = fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(allowed).toBe(true);
    expect(screen.getByLabelText("Markdown line 2")).toBeTruthy();
  });

  it("moves to the previous editor line only at the start boundary", () => {
    render(<HybridMarkdownEditor value={"first\nsecond"} />);
    activateLine("second");
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    setCaret(textarea, 0);
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(screen.getByLabelText("Markdown line 1")).toBeTruthy();
  });
});

describe("HybridMarkdownEditor rendering and mapping", () => {
  it("renders unordered, ordered, and task markers distinctly", () => {
    const { container } = render(
      <HybridMarkdownEditor value={"- bullet\n7. ordered\n- [ ] todo\n- [x] done"} readOnly />
    );
    const markers = Array.from(container.querySelectorAll('[data-role="line-marker"]')).map(
      (node) => node.textContent
    );
    expect(markers).toEqual(["•", "7.", "☐", "☑"]);
  });

  it("preserves list nesting visually through indentation", () => {
    const { container } = render(<HybridMarkdownEditor value={"- root\n    - nested"} readOnly />);
    const previews = container.querySelectorAll('[data-role="line-preview"]');
    expect((previews[0] as HTMLElement).style.paddingLeft).toBe("0px");
    expect((previews[1] as HTMLElement).style.paddingLeft).toBe("32px");
  });

  it("renders extension decorations with isActive=true while editing", () => {
    const seen: boolean[] = [];
    const extension: EditorExtension = {
      renderLinePrefix: ({ isActive }) => {
        seen.push(isActive);
        return <span>prefix</span>;
      },
    };
    render(<HybridMarkdownEditor value="source" extensions={[extension]} />);
    expect(seen).toContain(false);
    activateLine("source");
    expect(seen).toContain(true);
  });

  it("allows style hooks to override structural defaults", () => {
    const { container } = render(
      <HybridMarkdownEditor
        value="source"
        readOnly
        styles={{ preview: { paddingLeft: 77 }, line: { width: "50%" } }}
      />
    );
    expect((container.querySelector('[data-role="line-preview"]') as HTMLElement).style.paddingLeft).toBe("77px");
    expect((container.querySelector('[data-line-index="0"]') as HTMLElement).style.width).toBe("50%");
  });

  it("keeps extension prefix/suffix outside the source-mapped element", () => {
    const extension: EditorExtension = {
      renderLinePrefix: () => <span data-testid="prefix">PREFIX</span>,
      renderLineSuffix: () => <span data-testid="suffix">SUFFIX</span>,
    };
    const { container } = render(<HybridMarkdownEditor value="source" extensions={[extension]} readOnly />);
    const source = container.querySelector('[data-role="source-content"]') as HTMLElement;
    expect(source.textContent).toBe("source");
    expect(source.textContent).not.toContain("PREFIX");
    expect(source.textContent).not.toContain("SUFFIX");
  });

  it("keeps malformed bold markers visible and source-mappable", () => {
    const rendered = parseBold("**hello");
    expect(rendered).toEqual(["**hello"]);
    expect(mapDisplayOffsetToSourceIndex("**hello", 0)).toBe(0);
    expect(mapDisplayOffsetToSourceIndex("**hello", 2)).toBe(2);
  });

  it("treats four asterisks as literal text rather than empty bold", () => {
    expect(parseBold("****")).toEqual(["****"]);
    expect(mapDisplayOffsetToSourceIndex("****", 4)).toBe(4);
  });
});
