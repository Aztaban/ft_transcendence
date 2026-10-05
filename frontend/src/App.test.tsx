import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";

import App from "./App";
import { AuthProvider } from "./store/AuthContext";
import { RoleProvider } from "./store/RoleContext";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <RoleProvider>
          <App />
        </RoleProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

test("renders the home page at /", () => {
  renderAt("/");
  expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeDefined();
});

test("renders the 404 page for an unknown path", () => {
  renderAt("/does-not-exist");
  expect(screen.getByText("404")).toBeDefined();
  expect(screen.getByText("Page not found.")).toBeDefined();
});

test("renders the application shell around every route", () => {
  const { container } = renderAt("/");
  expect(container.querySelector(".sidebar")).toBeTruthy();
  expect(container.querySelector(".topbar")).toBeTruthy();
});
