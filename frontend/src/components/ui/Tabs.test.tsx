import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import Tabs from "./Tabs";

afterEach(cleanup);

function StatusTabs() {
  const [selected, setSelected] = useState<"pending" | "approved" | "declined">("pending");

  return (
    <>
      <Tabs
        label="Filter by status"
        items={[
          { id: "pending", label: "Pending" },
          { id: "approved", label: "Approved" },
          { id: "declined", label: "Declined" },
        ]}
        selected={selected}
        onSelect={setSelected}
      />
      <p>shown: {selected}</p>
    </>
  );
}

function tab(name: string) {
  return screen.getByRole("tab", { name });
}

describe("Tabs", () => {
  it("is a named tab list with one selected tab and one tab stop", () => {
    render(<StatusTabs />);

    expect(screen.getByRole("tablist", { name: "Filter by status" })).toBeTruthy();
    expect(tab("Pending").getAttribute("aria-selected")).toBe("true");
    expect(tab("Pending").tabIndex).toBe(0);
    expect(tab("Approved").tabIndex).toBe(-1);
  });

  it("selects a tab on click", () => {
    render(<StatusTabs />);

    fireEvent.click(tab("Declined"));

    expect(screen.getByText("shown: declined")).toBeTruthy();
    expect(tab("Declined").getAttribute("aria-selected")).toBe("true");
  });

  it("moves and selects with the arrow keys, Home and End, wrapping around", () => {
    render(<StatusTabs />);
    tab("Pending").focus();

    fireEvent.keyDown(tab("Pending"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Approved"));
    expect(screen.getByText("shown: approved")).toBeTruthy();

    fireEvent.keyDown(tab("Approved"), { key: "End" });
    expect(screen.getByText("shown: declined")).toBeTruthy();

    fireEvent.keyDown(tab("Declined"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Pending"));

    fireEvent.keyDown(tab("Pending"), { key: "ArrowLeft" });
    expect(screen.getByText("shown: declined")).toBeTruthy();

    fireEvent.keyDown(tab("Declined"), { key: "Home" });
    expect(screen.getByText("shown: pending")).toBeTruthy();
  });
});
