import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CancelRequestDialog from "./CancelRequestDialog";
import { makeRequest } from "./testUtils";

afterEach(cleanup);

const request = makeRequest(1, "minishell", "pending");

function dialog(isSubmitting: boolean, onClose = vi.fn()) {
  return (
    <CancelRequestDialog
      request={request}
      isSubmitting={isSubmitting}
      error=""
      onConfirm={vi.fn()}
      onClose={onClose}
    />
  );
}

describe("CancelRequestDialog", () => {
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
