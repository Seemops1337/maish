import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { EventCreateModal } from "./EventCreateModal";

function renderModal() {
  const onCreate = vi.fn();
  render(<EventCreateModal onClose={vi.fn()} onCreate={onCreate} />);
  return { onCreate };
}

const created = (onCreate: ReturnType<typeof vi.fn>) => onCreate.mock.calls[0]?.[0];

/** Fill in the dialog and submit it, so a test only states what it cares about. */
function submit(fields: { title?: string; allDay?: boolean; start?: string; end?: string }) {
  const { onCreate } = renderModal();

  fireEvent.change(screen.getByLabelText(/title/i), {
    target: { value: fields.title ?? "Event" },
  });
  if (fields.allDay) fireEvent.click(screen.getByLabelText(/all day/i));
  if (fields.start) {
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: fields.start } });
  }
  if (fields.end) {
    fireEvent.change(screen.getByLabelText(/^end$/i), { target: { value: fields.end } });
  }
  fireEvent.click(screen.getByRole("button", { name: /create/i }));

  return created(onCreate);
}

describe("EventCreateModal", () => {
  it("creates a one-off event when the repetition is left alone", () => {
    const { onCreate } = renderModal();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Lunch" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(created(onCreate)).toMatchObject({
      summary: "Lunch",
      recurrence: null,
      isAllDay: false,
    });
  });

  it("keeps the times as they are for an event that is not all day", () => {
    expect(submit({ start: "2026-09-10T14:30", end: "2026-09-10T15:30" })).toMatchObject({
      isAllDay: false,
      startTime: "2026-09-10T14:30",
      endTime: "2026-09-10T15:30",
    });
  });

  it("ends a one-day all-day event on the following day", () => {
    // DTEND and Google's end.date are both exclusive, so the day the dialog
    // asks for is the last one the event covers, not the one it is sent as.
    expect(submit({ allDay: true, start: "2026-09-10", end: "2026-09-10" })).toMatchObject({
      isAllDay: true,
      startTime: "2026-09-10T00:00",
      endTime: "2026-09-11T00:00",
    });
  });

  it("carries the end of a multi-day all-day event forward by one day", () => {
    expect(submit({ allDay: true, start: "2026-09-10", end: "2026-09-12" })).toMatchObject({
      startTime: "2026-09-10T00:00",
      endTime: "2026-09-13T00:00",
    });
  });

  it("collapses an all-day event that ends before it starts to a single day", () => {
    expect(submit({ allDay: true, start: "2026-09-10", end: "2026-09-08" })).toMatchObject({
      startTime: "2026-09-10T00:00",
      endTime: "2026-09-11T00:00",
    });
  });

  it("moves the end along when the start is pushed past it", () => {
    // Without this the range would run backwards and the dialog could only
    // refuse to save. The start alone is set, so the end has to follow.
    expect(submit({ allDay: true, start: "2026-09-20" })).toMatchObject({
      startTime: "2026-09-20T00:00",
      endTime: "2026-09-21T00:00",
    });
  });

  it("leaves an end that already lies after the start alone", () => {
    const { onCreate } = renderModal();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Holidays" } });
    fireEvent.click(screen.getByLabelText(/all day/i));
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: "2026-12-20" } });
    fireEvent.change(screen.getByLabelText(/^end$/i), { target: { value: "2026-12-27" } });
    // Moving the start again, but not past the end, must not drag it along.
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: "2026-12-22" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(created(onCreate)).toMatchObject({
      startTime: "2026-12-22T00:00",
      endTime: "2026-12-28T00:00",
    });
  });

  it("crosses a month boundary rather than producing a 32nd", () => {
    expect(submit({ allDay: true, start: "2026-09-30", end: "2026-09-30" })).toMatchObject({
      endTime: "2026-10-01T00:00",
    });
  });

  it("brings the time of day back when the switch is turned off again", () => {
    const { onCreate } = renderModal();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Trip" } });
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: "2026-09-10T14:30" } });

    const allDay = screen.getByLabelText(/all day/i);
    fireEvent.click(allDay);
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: "2026-09-11" } });
    fireEvent.click(allDay);

    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(created(onCreate)).toMatchObject({
      isAllDay: false,
      startTime: "2026-09-11T14:30",
    });
  });

  it("hands on both the all-day flag and the repetition", () => {
    const { onCreate } = renderModal();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Market" } });
    fireEvent.click(screen.getByLabelText(/all day/i));
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: "2026-09-10" } });
    fireEvent.change(screen.getByLabelText(/^repeat$/i), { target: { value: "weekly" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(created(onCreate)).toMatchObject({
      isAllDay: true,
      startTime: "2026-09-10T00:00",
      recurrence: { frequency: "weekly" },
    });
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
