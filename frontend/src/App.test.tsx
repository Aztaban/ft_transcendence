import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, test } from "vitest";

import App from "./App";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

test("renders the home page at /", () => {
  renderAt("/");
  expect(screen.getByText(/Frontend application initialized/)).toBeDefined();
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
