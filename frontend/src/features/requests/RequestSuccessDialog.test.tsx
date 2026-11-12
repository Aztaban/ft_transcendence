import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RequestSuccessDialog from "./RequestSuccessDialog";

afterEach(cleanup);

// Focus, Escape and a click inside come from the shared Dialog, tested in Dialog.test.tsx.
describe("RequestSuccessDialog", () => {
  it("is named by its title and closes on a click outside", () => {
    const onClose = vi.fn();
    render(<RequestSuccessDialog onClose={onClose} />);

    expect(
      screen.getByRole("dialog", { name: "Your request is live and waiting for a HITCHHIKER!" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("request-dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
