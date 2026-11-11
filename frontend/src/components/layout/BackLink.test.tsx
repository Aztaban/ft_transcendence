import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import BackLink from "./BackLink";

afterEach(cleanup);

function renderAt(entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/pending" element={<p>Pending page</p>} />
        <Route path="/evaluations/7" element={<BackLink className="evaluation__back" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BackLink", () => {
  it("goes back to Home when the page was opened directly", () => {
    renderAt(["/evaluations/7"]);

    const link = screen.getByRole("link", { name: "Back to home" });

    expect(link.getAttribute("href")).toBe("/");
    fireEvent.click(link);
    expect(screen.getByText("Home page")).toBeTruthy();
  });

  it("goes back to the page the user came from", () => {
    renderAt(["/pending", "/evaluations/7"]);
    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("Pending page")).toBeTruthy();
  });
});
