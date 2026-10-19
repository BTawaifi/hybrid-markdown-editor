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

  it("renders checklist values and details, and roadmap details", () => {
    const list = render(<ChatMarkdownRenderer widgets markdown={fenced("checklist", "title: Ingredients\n- [ ] Pasta | 200 g\n- [ ] Boil the pasta | | Salt the water first")} />);
    expect(list.container.querySelector(".hme-w-value")?.textContent).toBe("200 g");
    expect(list.container.querySelectorAll(".hme-w-value")).toHaveLength(1);
    expect(list.container.querySelector(".hme-w-detail")?.textContent).toBe("Salt the water first");
    const road = render(<ChatMarkdownRenderer widgets markdown={fenced("roadmap", "- [ ] Basics | Core | Routing and layouts\n- [ ] Extras")} />);
    expect(road.container.querySelector(".hme-w-tag")?.textContent).toBe("Core");
    expect(road.container.querySelector(".hme-w-detail")?.textContent).toBe("Routing and layouts");
  });

  it("renders card badges and the grid layout", () => {
    const { container } = render(<ChatMarkdownRenderer widgets markdown={fenced("cards grid", "Incident | Live scores freeze | 20:43 UTC | SEV-1\nPlain card")} />);
    expect(container.querySelector(".hme-cards")?.classList.contains("is-grid")).toBe(true);
    expect(container.querySelector(".hme-w-badge")?.textContent).toBe("SEV-1");
    expect(container.querySelectorAll(".hme-w-badge")).toHaveLength(1);
  });

  it("renders callouts with variant, default label and paragraphs", () => {
    const { container } = render(<ChatMarkdownRenderer widgets markdown={fenced("callout tip", "title: Chef's tip\nStarchy water\nemulsifies the sauce.\n\nAdd cheese **off** the heat.")} />);
    const callout = container.querySelector(".hme-callout");
    expect(callout?.classList.contains("is-tip")).toBe(true);
    expect(callout?.getAttribute("role")).toBe("note");
    expect(callout?.querySelector(".hme-w-title")?.textContent).toBe("Chef's tip");
    expect([...callout!.querySelectorAll("p:not(.hme-w-title)")].map(p => p.textContent)).toEqual(["Starchy water emulsifies the sauce.", "Add cheese off the heat."]);
    expect(callout?.querySelector("strong")?.textContent).toBe("off");
    const plain = render(<ChatMarkdownRenderer widgets markdown={fenced("callout warning", "Back up first.")} />);
    expect(plain.container.querySelector(".hme-callout .hme-w-title")?.textContent).toBe("Warning");
    const empty = render(<ChatMarkdownRenderer widgets markdown={fenced("callout", "")} />);
    expect(empty.container.querySelector(".hme-code-block")).toBeTruthy();
  });
});
