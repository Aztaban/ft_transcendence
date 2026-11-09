import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RequestSuccessDialog from "./RequestSuccessDialog";

afterEach(cleanup);

describe("RequestSuccessDialog", () => {
  it("closes on a click outside or Escape, not on a click inside", () => {
    const onClose = vi.fn();
    render(<RequestSuccessDialog onClose={onClose} />);

    const dialog = screen.getByRole("dialog", {
      name: "Your request is live and waiting for a HITCHHIKER!",
    });

    expect(document.activeElement).toBe(dialog);

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("request-dialog-backdrop"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
