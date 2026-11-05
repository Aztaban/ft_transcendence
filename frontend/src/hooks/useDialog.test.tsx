import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import useDialog from "./useDialog";

afterEach(cleanup);

function Dialog({ onClose, empty = false }: { onClose: () => void; empty?: boolean }) {
  const cardRef = useDialog<HTMLDivElement>(onClose);

  return (
    <div ref={cardRef} role="dialog" aria-label="Test dialog" tabIndex={-1}>
      {!empty && (
        <>
          <button type="button">First</button>
          <button type="button" disabled>
            Disabled
          </button>
          <button type="button" onClick={onClose}>
            Last
          </button>
        </>
      )}
    </div>
  );
}

function Page({ empty = false }: { empty?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showOpener, setShowOpener] = useState(true);

  return (
    <>
      {showOpener && (
        <button type="button" onClick={() => setIsOpen(true)}>
          Open
        </button>
      )}
      <button type="button">Behind the popup</button>
      <button
        type="button"
        onClick={() => {
          setShowOpener(false);
          setIsOpen(false);
        }}
      >
        Close and remove the opener
      </button>
      {isOpen && <Dialog onClose={() => setIsOpen(false)} empty={empty} />}
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

  it("keeps Tab and Shift+Tab inside the popup, skipping disabled buttons", () => {
    render(<Page />);
    openDialog();

    screen.getByRole("button", { name: "Last" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Last" }));
  });

  it("goes to the last button on Shift+Tab from the card itself", () => {
    render(<Page />);
    openDialog();

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

  it("keeps the focus on the card when the popup has nothing to tab to", () => {
    render(<Page empty />);
    openDialog();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByRole("dialog"));
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

  it("leaves the focus alone when the opener is gone, e.g. after a navigation", () => {
    render(<Page />);
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Close and remove the opener" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });
});
