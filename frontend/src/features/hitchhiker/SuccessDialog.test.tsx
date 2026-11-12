import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SuccessDialog from "./SuccessDialog";

afterEach(cleanup);

describe("SuccessDialog", () => {
  it("is named by its message and closes on a click outside or Escape, not inside", () => {
    const onClose = vi.fn();
    render(<SuccessDialog onClose={onClose}>Slot sent to the student!</SuccessDialog>);

    const dialog = screen.getByRole("dialog", { name: "Slot sent to the student!" });

    expect(document.activeElement).toBe(dialog);

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("success-dialog-backdrop"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
