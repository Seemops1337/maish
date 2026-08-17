import { cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CalendarToolbar } from "./CalendarToolbar";

function renderToolbar(date: Date) {
  return render(
    <CalendarToolbar
      currentDate={date}
      view="month"
      onPrev={vi.fn()}
      onNext={vi.fn()}
      onToday={vi.fn()}
      onViewChange={vi.fn()}
      onCreateEvent={vi.fn()}
    />,
  );
}

describe("CalendarToolbar", () => {
  it("keeps the navigation buttons ahead of the title", () => {
    renderToolbar(new Date(2026, 8, 15));

    const prev = screen.getByRole("button", { name: "Previous month" });
    const title = screen.getByRole("heading", { level: 2 });

    expect(
      prev.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders the navigation buttons at the same position for short and long titles", () => {
    renderToolbar(new Date(2026, 4, 15)); // May 2026
    const shortLayout = navSignature();
    cleanup();

    renderToolbar(new Date(2026, 8, 15)); // September 2026
    expect(navSignature()).toEqual(shortLayout);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "September 2026",
    );
  });

  it("labels the navigation buttons for the current view", () => {
    render(
      <CalendarToolbar
        currentDate={new Date(2026, 4, 15)}
        view="week"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onViewChange={vi.fn()}
        onCreateEvent={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Previous week" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeInTheDocument();
  });
});

// The buttons sit in a container whose siblings precede the title, so the
// preceding markup — and therefore the rendered offset — must not vary with it.
function navSignature(): string[] {
  const nav = screen.getByRole("button", { name: /^Previous / }).parentElement!;
  const preceding: string[] = [];
  let node: Element | null = nav;
  while (node && node.tagName !== "BODY") {
    let sibling = node.previousElementSibling;
    while (sibling) {
      preceding.push(sibling.textContent ?? "");
      sibling = sibling.previousElementSibling;
    }
    node = node.parentElement;
  }
  return preceding;
}
