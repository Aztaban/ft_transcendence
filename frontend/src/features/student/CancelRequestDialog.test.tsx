import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CancelRequestDialog from "./CancelRequestDialog";
import { makeRequest } from "./testUtils";

afterEach(cleanup);

const request = makeRequest(1, "minishell", "pending");

function dialog(isSubmitting: boolean, onClose = vi.fn(), shown = request) {
  return (
    <CancelRequestDialog
      request={shown}
      isSubmitting={isSubmitting}
      error=""
      onConfirm={vi.fn()}
      onClose={onClose}
    />
  );
}

describe("CancelRequestDialog", () => {
  // What cancelling ends depends on the request's state (api-plan §7.1).
  it.each([
    ["pending", "Hitchhikers won't see the request anymore."],
    ["awaiting_confirmation", "The proposed slot is dropped and the Hitchhiker is told."],
    ["confirmed", "The evaluation is cancelled and the Hitchhiker is told."],
  ] as const)("says what cancelling a %s request ends", (status, consequence) => {
    render(dialog(false, vi.fn(), makeRequest(1, "minishell", status)));

    expect(document.querySelector(".cancel-request__text")?.textContent).toBe(
      `${consequence} This can't be undone, but you can create a new request anytime.`,
    );
  });

  it("closes on a click outside, not inside, and not while the cancellation is being sent", () => {
    const onClose = vi.fn();
    const { rerender } = render(dialog(true, onClose));

    fireEvent.click(screen.getByTestId("cancel-request-backdrop"));
    expect(onClose).not.toHaveBeenCalled();

    rerender(dialog(false, onClose));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("cancel-request-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape while the cancellation is being sent", () => {
    const onClose = vi.fn();
    const { rerender } = render(dialog(true, onClose));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    rerender(dialog(false, onClose));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("puts the focus back on the dialog when sending starts and ends", () => {
    const outside = document.body.appendChild(document.createElement("input"));
    const { rerender } = render(dialog(false));
    const card = screen.getByRole("dialog");
    expect(document.activeElement).toBe(card);

    outside.focus();
    rerender(dialog(true));
    expect(document.activeElement).toBe(card);

    outside.focus();
    rerender(dialog(false));
    expect(document.activeElement).toBe(card);
    outside.remove();
  });
});
