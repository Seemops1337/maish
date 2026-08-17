import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { RecurrenceField } from "./RecurrenceField";
import type { RecurrenceForm } from "@/services/calendar/recurrenceForm";

const WEEKLY: RecurrenceForm = {
  frequency: "weekly",
  interval: 1,
  byDay: [],
  end: { kind: "never" },
};

function renderField(props: Partial<React.ComponentProps<typeof RecurrenceField>> = {}) {
  const onChange = vi.fn();
  render(
    <RecurrenceField
      value={null}
      onChange={onChange}
      startDate="2026-01-05"
      {...props}
    />,
  );
  return { onChange };
}

describe("RecurrenceField", () => {
  it("shows only the frequency until the event repeats at all", () => {
    renderField();

    expect(screen.getByLabelText(/^repeat$/i)).toHaveValue("none");
    expect(screen.queryByLabelText(/^every$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^ends$/i)).not.toBeInTheDocument();
  });

  it("starts a rule when a frequency is chosen", () => {
    const { onChange } = renderField();

    fireEvent.change(screen.getByLabelText(/^repeat$/i), { target: { value: "daily" } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      frequency: "daily",
      interval: 1,
      end: { kind: "never" },
    }));
  });

  it("clears the rule when the repetition is switched off", () => {
    const { onChange } = renderField({ value: WEEKLY });

    fireEvent.change(screen.getByLabelText(/^repeat$/i), { target: { value: "none" } });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("names the unit after the frequency and the count", () => {
    const { onChange } = renderField({ value: { ...WEEKLY, frequency: "monthly" } });
    expect(screen.getByText("month")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^every$/i), { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ interval: 3 }));
  });

  it("offers weekday chips for a weekly rule", () => {
    renderField({ value: WEEKLY });

    expect(screen.getByRole("button", { name: "Wednesday" })).toBeInTheDocument();
    expect(screen.getByText(/follows the day the event starts on/i)).toBeInTheDocument();
  });

  it("hides the weekday chips on a monthly rule", () => {
    // BYDAY means something else there, so the chips would be a lie.
    renderField({ value: { ...WEEKLY, frequency: "monthly" } });
    expect(screen.queryByRole("button", { name: "Wednesday" })).not.toBeInTheDocument();
  });

  it("toggles a weekday on and off again", () => {
    const { onChange } = renderField({ value: { ...WEEKLY, byDay: [1] } });

    fireEvent.click(screen.getByRole("button", { name: "Wednesday" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ byDay: [1, 3] }));

    fireEvent.click(screen.getByRole("button", { name: "Monday" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ byDay: [] }));
  });

  it("switches the end between never, a count and a date", () => {
    const { onChange } = renderField({ value: WEEKLY });
    const ends = screen.getByLabelText(/^ends$/i);

    fireEvent.change(ends, { target: { value: "count" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      end: { kind: "count", count: 10 },
    }));

    fireEvent.change(ends, { target: { value: "onDate" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      end: { kind: "onDate", date: "2026-04-05" },
    }));
  });

  it("takes an end date from the picker", () => {
    const { onChange } = renderField({
      value: { ...WEEKLY, end: { kind: "onDate", date: "2026-04-05" } },
    });

    fireEvent.change(screen.getByLabelText(/last date/i), { target: { value: "2026-06-30" } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      end: { kind: "onDate", date: "2026-06-30" },
    }));
  });

  describe("a rule the control cannot state", () => {
    const custom = { customRule: "Repeats every month", value: null };

    it("shows it and leaves it alone", () => {
      renderField(custom);

      expect(screen.getByText("Repeats every month")).toBeInTheDocument();
      expect(screen.getByText(/kept as it is/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/^repeat$/i)).not.toBeInTheDocument();
    });

    it("replaces it only on a deliberate click, seeded from the start date", () => {
      const { onChange } = renderField(custom);

      fireEvent.click(screen.getByRole("button", { name: /replace with a simple rule/i }));

      // 5 January 2026 is a Monday.
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        frequency: "weekly",
        byDay: [1],
      }));
    });

    it("can drop it outright", () => {
      const { onChange } = renderField(custom);

      fireEvent.click(screen.getByRole("button", { name: /remove repetition/i }));

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it("offers neither while the control is locked", () => {
      renderField({ ...custom, disabledReason: "Not here" });

      expect(screen.queryByRole("button", { name: /replace/i })).not.toBeInTheDocument();
      expect(screen.getByText("Not here")).toBeInTheDocument();
    });
  });

  it("disables every input when a reason is given", () => {
    renderField({ value: WEEKLY, disabledReason: "Belongs to the series" });

    expect(screen.getByLabelText(/^repeat$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^every$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^ends$/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Wednesday" })).toBeDisabled();
  });
});
