import { render, screen } from "@testing-library/react";
import { test, expect, vi, beforeEach } from "vitest";
import App from "./App";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ status: "ok", db: "ok", redis: "ok" }),
      }),
    ) as unknown as typeof fetch,
  );
});

test("renders heading", () => {
  render(<App />);
  expect(screen.getByText("ft_transcendence")).toBeInTheDocument();
});
