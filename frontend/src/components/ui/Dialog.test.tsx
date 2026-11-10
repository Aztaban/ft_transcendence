import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Dialog from "./Dialog";

afterEach(cleanup);

function renderDialog(props: Partial<Parameters<typeof Dialog>[0]> = {}) {
  const onClose = vi.fn();

  render(
    <>
      <button type="button">Opener</button>
      <Dialog titleId="dialog-title" onClose={onClose} backdropTestId="backdrop" {...props}>
        <h2 id="dialog-title">Delete message #3?</h2>
        <button type="button">Confirm</button>
      </Dialog>
    </>,
  );

  return onClose;
}

describe("Dialog", () => {
  it("is a modal dialog named by its title, with the focus on its card", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Delete message #3?" });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog);
    expect(dialog.className).toBe("ui-dialog__card");
  });

  it("closes on Escape and on a click outside the card, not on a click inside", () => {
    const onClose = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("backdrop"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("stays open on a click outside when the user must decide", () => {
    const onClose = renderDialog({ closeOnBackdrop: false });

    fireEvent.click(screen.getByTestId("backdrop"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the page's own look when it passes its classes", () => {
    renderDialog({ className: "message-sent__card", backdropClassName: "message-sent" });

    expect(screen.getByRole("dialog").className).toBe("message-sent__card");
    expect(screen.getByTestId("backdrop").className).toBe("message-sent");
  });
});
