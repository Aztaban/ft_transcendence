import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoadError from "./LoadError";

afterEach(cleanup);

describe("LoadError", () => {
  it("says what failed and loads again on Try again", () => {
    const onRetry = vi.fn();

    render(<LoadError onRetry={onRetry}>Could not load your history. Please try again.</LoadError>);

    const alert = screen.getByRole("alert");

    expect(alert.className).toBe("ui-load-error");
    expect(alert.querySelector("p")?.textContent).toBe(
      "Could not load your history. Please try again.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the page's own class", () => {
    render(
      <LoadError className="history-page__error" onRetry={() => {}}>
        Could not load your history.
      </LoadError>,
    );

    expect(screen.getByRole("alert").className).toBe("ui-load-error history-page__error");
  });
});
