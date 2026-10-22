import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import useDialog from "./useDialog";

afterEach(cleanup);

function Dialog({ onClose, closeOnEscape }: { onClose: () => void; closeOnEscape?: boolean }) {
  const cardRef = useDialog<HTMLDivElement>(onClose, { closeOnEscape });

  return (
    <div ref={cardRef} role="dialog" aria-label="Test dialog" tabIndex={-1}>
      <button type="button">First</button>
      <button type="button" disabled>
        Disabled
      </button>
      <button type="button" onClick={onClose}>
        Last
      </button>
    </div>
  );
}

function Page({ closeOnEscape }: { closeOnEscape?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <button type="button">Behind the popup</button>
      {isOpen && <Dialog onClose={() => setIsOpen(false)} closeOnEscape={closeOnEscape} />}
    </>
  );
}

function openDialog() {
  const opener = screen.getByRole("button", { name: "Open" });

  opener.focus();
  fireEvent.click(opener);

  return opener;
}

describe("useDialog", () => {
  it("focuses the popup when it opens", () => {
    render(<Page />);
    openDialog();

    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("keeps Tab and Shift+Tab inside the popup", () => {
    render(<Page />);
    openDialog();

    screen.getByRole("button", { name: "Last" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Last" }));
  });

  it("brings the focus back inside when it is on the page behind", () => {
    render(<Page />);
    openDialog();

    screen.getByRole("button", { name: "Behind the popup" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  });

  it("closes on Escape and gives the focus back to the button that opened it", () => {
    render(<Page />);
    const opener = openDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("gives the focus back when the popup closes from one of its buttons", () => {
    render(<Page />);
    const opener = openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Last" }));

    expect(document.activeElement).toBe(opener);
  });

  it("ignores Escape while closing is not allowed", () => {
    render(<Page closeOnEscape={false} />);
    openDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
