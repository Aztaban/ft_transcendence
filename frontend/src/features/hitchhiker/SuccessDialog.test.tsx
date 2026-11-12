import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SuccessDialog from "./SuccessDialog";

afterEach(cleanup);

// Focus, Escape and a click inside come from the shared Dialog, tested in Dialog.test.tsx.
describe("SuccessDialog", () => {
  it("is named by its message and closes on a click outside", () => {
    const onClose = vi.fn();
    render(<SuccessDialog onClose={onClose}>Slot sent to the student!</SuccessDialog>);

    expect(screen.getByRole("dialog", { name: "Slot sent to the student!" })).toBeTruthy();

    fireEvent.click(screen.getByTestId("success-dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
