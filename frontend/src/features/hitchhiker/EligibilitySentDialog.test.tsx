import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EligibilitySentDialog from "./EligibilitySentDialog";

afterEach(cleanup);

// Focus, Escape and a click inside come from the shared Dialog, tested in Dialog.test.tsx.
describe("EligibilitySentDialog", () => {
  it("is named by its title and closes on a click outside", () => {
    const onClose = vi.fn();
    render(<EligibilitySentDialog onClose={onClose} />);

    expect(
      screen.getByRole("dialog", { name: "Your request was sent to the HEAD TUTORS!" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("eligibility-dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
