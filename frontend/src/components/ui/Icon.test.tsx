import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Icon, { ICON_NAMES } from "./Icon";

afterEach(cleanup);

describe("Icon", () => {
  it("is decoration by default, hidden from screen readers", () => {
    const { container } = render(<Icon name="bell" className="topbar__bell" />);
    const image = container.querySelector("img") as HTMLImageElement;

    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("aria-hidden")).toBe("true");
    expect(image.className).toBe("ui-icon topbar__bell");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("is named when it carries meaning on its own", () => {
    render(<Icon name="search" label="Search" size={20} />);

    const image = screen.getByRole("img", { name: "Search" });

    expect(image.getAttribute("aria-hidden")).toBeNull();
    expect(image.getAttribute("width")).toBe("20");
  });

  it("has a file for every icon of the set", () => {
    for (const name of ICON_NAMES) {
      const { container } = render(<Icon name={name} />);

      expect(container.querySelector("img")?.getAttribute("src")).toBeTruthy();
      cleanup();
    }
  });
});
