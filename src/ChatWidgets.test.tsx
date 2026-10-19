import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdownRenderer } from "./ChatMarkdownRenderer";

const fenced = (info: string, body: string) => "```" + info + "\n" + body + "\n```";

describe("widget fences", () => {
  it("renders a flow with labels, details and auto direction", () => {
    const { container } = render(<ChatMarkdownRenderer widgets markdown={fenced("flow", "Browser | Fetch JS\nReact | Render **UI**\nDisplay | Content")} />);
    expect(container.querySelectorAll(".hme-flow-step")).toHaveLength(3);
    expect(container.querySelector(".hme-flow")?.classList.contains("is-vertical")).toBe(false);
    expect(container.querySelector(".hme-flow-detail strong")?.textContent).toBe("UI");
    const long = render(<ChatMarkdownRenderer widgets markdown={fenced("flow", "a | 1\nb | 2\nc | 3\nd | 4\ne | 5")} />);
    expect(long.container.querySelector(".hme-flow")?.classList.contains("is-vertical")).toBe(true);
  });

  it("renders a checklist with a done count", () => {
    const { container } = render(<ChatMarkdownRenderer widgets markdown={fenced("checklist", "title: Production readiness\n- [x] Build passes\n- [ ] Secrets set")} />);
    expect(screen.getByText("Production readiness")).toBeTruthy();
    expect(container.querySelector(".hme-w-count")?.textContent).toBe("1/2");
    expect(container.querySelectorAll("input[type='checkbox']:checked")).toHaveLength(1);
  });

  it("renders a roadmap with numbering, tags and progress", () => {
    const { container } = render(<ChatMarkdownRenderer widgets markdown={fenced("roadmap", "title: Course\nunit: chapters\n- [x] Basics | Core\n- [ ] Advanced topics | Advanced")} />);
    expect(container.querySelector(".hme-w-count")?.textContent).toBe("2 chapters");
    expect(container.querySelector(".hme-w-num")?.textContent).toBe("01.");
    expect(container.querySelector(".hme-w-tag")?.textContent).toBe("Core");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("renders cards with title, body and note", () => {
    const { container } = render(<ChatMarkdownRenderer widgets markdown={fenced("cards", "Exercise 1 | Build CRUD | Tests: routing\nExercise 2 | Add auth")} />);
    expect(container.querySelectorAll(".hme-card")).toHaveLength(2);
    expect(container.querySelector(".hme-card-title")?.textContent).toBe("Exercise 1");
    expect(container.querySelectorAll(".hme-w-note")).toHaveLength(1);
  });

  it("renders an interactive choice that updates the recommendation", () => {
    render(<ChatMarkdownRenderer widgets markdown={fenced("choice", "title: Pick\nprompt: What do you need?\n- Show data | Server Component | Fetch on the server\n- Submit a form | Server Action | Mutate safely")} />);
    expect(screen.getByText("Server Component")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Submit a form" }));
    expect(screen.getByText("Server Action")).toBeTruthy();
    expect(screen.queryByText("Server Component")).toBeNull();
  });

  it("falls back to a code block when a widget fence has no items, and never renders HTML", () => {
    const empty = render(<ChatMarkdownRenderer widgets markdown={fenced("flow", "")} />);
    expect(empty.container.querySelector(".hme-code-block")).toBeTruthy();
    const { container } = render(<ChatMarkdownRenderer widgets markdown={fenced("cards", "<img src=x onerror=alert(1)> | <script>x</script>")} />);
    expect(container.querySelectorAll("img, script")).toHaveLength(0);
    expect(container.querySelector(".hme-card-title")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("is off by default: widget fences stay code blocks and widget styles are not injected", () => {
    const { container } = render(<ChatMarkdownRenderer markdown={fenced("flow", "Browser | Fetch JS\nReact | Render UI")} />);
    expect(container.querySelector(".hme-flow")).toBeNull();
    expect(container.querySelector(".hme-code-block pre code")?.textContent).toBe("Browser | Fetch JS\nReact | Render UI");
    expect(container.querySelector("style")?.textContent).not.toContain("hme-widget");
  });
});
