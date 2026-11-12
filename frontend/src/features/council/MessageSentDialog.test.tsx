import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessageSentDialog from "./MessageSentDialog";

afterEach(cleanup);

// Focus, Escape and a click inside come from the shared Dialog, tested in Dialog.test.tsx.
describe("MessageSentDialog", () => {
  it("is named by its title and closes on a click outside", () => {
    const onClose = vi.fn();
    render(<MessageSentDialog onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Message Sent" })).toBeTruthy();

    fireEvent.click(screen.getByTestId("message-sent-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
