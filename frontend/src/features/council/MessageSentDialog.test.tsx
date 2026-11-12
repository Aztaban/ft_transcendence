import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessageSentDialog from "./MessageSentDialog";

afterEach(cleanup);

describe("MessageSentDialog", () => {
  it("closes on a click outside or Escape, not on a click inside", () => {
    const onClose = vi.fn();
    render(<MessageSentDialog onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Message Sent" });

    expect(document.activeElement).toBe(dialog);

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("message-sent-backdrop"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
