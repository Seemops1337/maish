import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { EventCreateModal } from "./EventCreateModal";

function renderModal() {
  const onCreate = vi.fn();
  render(<EventCreateModal onClose={vi.fn()} onCreate={onCreate} />);
  return { onCreate };
}

const created = (onCreate: ReturnType<typeof vi.fn>) => onCreate.mock.calls[0]?.[0];

describe("EventCreateModal", () => {
  it("creates a one-off event when the repetition is left alone", () => {
    const { onCreate } = renderModal();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Lunch" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(created(onCreate)).toMatchObject({ summary: "Lunch", recurrence: null });
  });

  it("hands the chosen repetition to the caller", () => {
    const { onCreate } = renderModal();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Standup" } });
    fireEvent.change(screen.getByLabelText(/^repeat$/i), { target: { value: "weekly" } });
    fireEvent.change(screen.getByLabelText(/^every$/i), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    fireEvent.change(screen.getByLabelText(/^ends$/i), { target: { value: "count" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(created(onCreate).recurrence).toEqual({
      frequency: "weekly",
      interval: 2,
      byDay: [2],
      end: { kind: "count", count: 10 },
    });
  });
});
