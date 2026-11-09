import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReasonDialog from "./ReasonDialog";

afterEach(cleanup);

// The popup that asks for the reason of an override (api-plan §5.8) or an account action
// (§10.2), shared by the evaluation page and the Admin user page.
function renderDialog(props: Partial<ComponentProps<typeof ReasonDialog>> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  const view = render(
    <ReasonDialog
      title="Suspend Anna?"
      text="Anna cannot log in until the account is reactivated."
      confirmLabel="Suspend"
      workingLabel="Suspending…"
      tone="warning"
      isSubmitting={false}
      error=""
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );

  return { ...view, onConfirm, onClose };
}

function button(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function reasonBox() {
  return screen.getByRole("textbox", { name: "Reason" }) as HTMLTextAreaElement;
}

describe("ReasonDialog", () => {
  it("is named by its title, described by its text and shown above the whole page", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", {
      name: "Suspend Anna?",
      description: "Anna cannot log in until the account is reactivated.",
    });

    expect(document.activeElement).toBe(dialog);
    expect(screen.getByTestId("reason-dialog-backdrop").parentElement).toBe(document.body);
  });

  it("asks for a reason of up to 500 characters, with its hint and a counter", () => {
    renderDialog();

    const reason = screen.getByRole("textbox", {
      name: "Reason",
      description: "Required. It is kept in the audit log.",
    }) as HTMLTextAreaElement;

    expect(reason.maxLength).toBe(500);
    expect(screen.getByText("0 / 500")).toBeTruthy();

    fireEvent.change(reason, { target: { value: "Spam account" } });

    expect(screen.getByText("12 / 500")).toBeTruthy();
  });

  it("waits for a reason that is not only spaces, then sends it trimmed", () => {
    const { onConfirm } = renderDialog();

    expect(button("Suspend").disabled).toBe(true);

    fireEvent.change(reasonBox(), { target: { value: "   " } });
    expect(button("Suspend").disabled).toBe(true);

    fireEvent.change(reasonBox(), { target: { value: "  Spam account " } });
    fireEvent.click(button("Suspend"));

    expect(onConfirm).toHaveBeenCalledWith("Spam account");
  });

  it("shows the last failure inside the popup", () => {
    renderDialog({ error: "Please give a reason." });

    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toBe(
      "Please give a reason.",
    );
  });

  it("closes on Cancel, Escape or a click outside, not on a click inside", () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(button("Cancel"));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("reason-dialog-backdrop"));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("cannot be closed or confirmed again while the request runs", () => {
    const { onClose } = renderDialog({ isSubmitting: true });

    fireEvent.change(reasonBox(), { target: { value: "Spam account" } });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("reason-dialog-backdrop"));

    expect(onClose).not.toHaveBeenCalled();
    expect(button("Suspending…").disabled).toBe(true);
    expect(button("Cancel").disabled).toBe(true);
  });

  it("is red for an action that cannot be undone", () => {
    renderDialog({ tone: "danger", confirmLabel: "Delete" });

    expect(screen.getByRole("dialog").className).toBe(
      "reason-dialog__card reason-dialog__card--danger",
    );
    expect(button("Delete").className).toBe(
      "reason-dialog__confirm reason-dialog__confirm--danger",
    );
  });
});
