import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import BackLink from "./BackLink";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

// Opens `paths` in this tab, one after the other, as React Router records them: `idx` numbers the
// entries from 0 for the first page of the app. The last one is shown.
function openInTab(...paths: string[]) {
  paths.forEach((path, index) => {
    const entry = { usr: null, key: `entry${index}`, idx: index };

    if (index === 0) {
      window.history.replaceState(entry, "", path);
    } else {
      window.history.pushState(entry, "", path);
    }
  });

  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/pending" element={<p>Pending page</p>} />
        <Route path="/login" element={<Navigate to="/evaluations/7" replace />} />
        <Route path="/evaluations/7" element={<BackLink className="evaluation__back" />} />
      </Routes>
    </BrowserRouter>,
  );
}

describe("BackLink", () => {
  it("goes back to Home when the page was opened directly", () => {
    openInTab("/evaluations/7");

    const link = screen.getByRole("link", { name: "Back to home" });

    expect(link.getAttribute("href")).toBe("/");
    fireEvent.click(link);
    expect(screen.getByText("Home page")).toBeTruthy();
  });

  // A pasted link while logged out goes through the login page, which then replaces itself with
  // the page: there is still nothing of the app to go back to.
  it("goes back to Home after a redirect replaced the first page", () => {
    openInTab("/login");

    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
  });

  it("goes back to the page the user came from", async () => {
    openInTab("/pending", "/evaluations/7");
    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(await screen.findByText("Pending page")).toBeTruthy();
  });
});
