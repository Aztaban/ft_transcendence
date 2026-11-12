import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EligibilitySentDialog from "./EligibilitySentDialog";

afterEach(cleanup);

describe("EligibilitySentDialog", () => {
  it("closes on a click outside or Escape, not on a click inside", () => {
    const onClose = vi.fn();
    render(<EligibilitySentDialog onClose={onClose} />);

    const dialog = screen.getByRole("dialog", {
      name: "Your request was sent to the HEAD TUTORS!",
    });

    expect(document.activeElement).toBe(dialog);

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("eligibility-dialog-backdrop"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
