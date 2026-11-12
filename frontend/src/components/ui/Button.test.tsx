import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Button from "./Button";

afterEach(cleanup);

// A form that records its submits instead of leaving the page.
function renderInForm(button: JSX.Element) {
  const submitted = vi.fn();

  render(
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        submitted();
      }}
    >
      {button}
    </form>,
  );

  return submitted;
}

describe("Button", () => {
  it("is a plain button by default, so it never sends a form by accident", () => {
    const submitted = renderInForm(<Button>Preview</Button>);

    const button = screen.getByRole("button", { name: "Preview" }) as HTMLButtonElement;
    fireEvent.click(button);

    expect(button.type).toBe("button");
    expect(submitted).not.toHaveBeenCalled();
  });

  it("sends its form when it is a submit button", () => {
    const submitted = renderInForm(<Button type="submit">Log in</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it("is primary unless another variant is chosen, and keeps extra classes", () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="ghost" className="login__link">
          Back
        </Button>
      </>,
    );

    expect(screen.getAllByRole("button").map((button) => button.className)).toEqual([
      "ui-button ui-button--primary",
      "ui-button ui-button--ghost login__link",
    ]);
  });

  it("ignores clicks while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Saving…
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
