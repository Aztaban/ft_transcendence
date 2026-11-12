import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import Checkbox from "./Checkbox";

afterEach(cleanup);

// A controlled checkbox, as the design system page uses it (#730).
function Controlled() {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <Checkbox
      label="Remember me"
      checked={isChecked}
      onChange={(event) => setIsChecked(event.target.checked)}
    />
  );
}

describe("Checkbox", () => {
  it("is a real checkbox named by its label, with the drawn box hidden from screen readers", () => {
    const { container } = render(<Checkbox label="Remember me" name="remember" />);

    const box = screen.getByRole("checkbox", { name: "Remember me" }) as HTMLInputElement;

    expect([box.type, box.name, box.checked]).toEqual(["checkbox", "remember", false]);
    expect(container.querySelector(".ui-checkbox__control")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("is ticked and unticked by a click on its label", () => {
    render(<Controlled />);

    const box = screen.getByRole("checkbox", { name: "Remember me" }) as HTMLInputElement;

    fireEvent.click(screen.getByText("Remember me"));
    expect(box.checked).toBe(true);

    fireEvent.click(screen.getByText("Remember me"));
    expect(box.checked).toBe(false);
  });

  it("gives checkboxes without an id their own ids, so each label ticks its own box", () => {
    render(
      <>
        <Checkbox label="push_swap" />
        <Checkbox label="minishell" />
      </>,
    );

    fireEvent.click(screen.getByText("minishell"));

    expect(screen.getAllByRole("checkbox").map((box) => (box as HTMLInputElement).checked)).toEqual(
      [false, true],
    );
  });

  it("uses a given id and keeps extra classes on the label", () => {
    const { container } = render(<Checkbox id="terms" label="I agree" className="extra" />);

    expect(screen.getByRole("checkbox", { name: "I agree" }).id).toBe("terms");
    expect(container.querySelector("label")?.className).toBe("ui-checkbox extra");
  });

  // The browser then ignores clicks on it (jsdom does not, so only the attribute is checked).
  it("passes disabled on to the real checkbox", () => {
    render(<Checkbox label="Remember me" disabled />);

    expect(
      (screen.getByRole("checkbox", { name: "Remember me" }) as HTMLInputElement).disabled,
    ).toBe(true);
  });
});
