import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MarkedReadDialog from "./MarkedReadDialog";

afterEach(cleanup);

describe("MarkedReadDialog", () => {
  it("closes on a click outside or Escape, not on a click inside", () => {
    const onClose = vi.fn();
    render(<MarkedReadDialog onClose={onClose} />);

    const dialog = screen.getByRole("dialog", { name: "Done. The message is marked as read." });

    expect(document.activeElement).toBe(dialog);

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("marked-read-backdrop"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
