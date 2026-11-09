import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Input from "./Input";

afterEach(cleanup);

// The text field of the Login, Register and Profile forms. An error is shown under the field and
// linked to it with aria-describedby, so a screen reader reads it with the field (WCAG 3.3.1).
describe("Input", () => {
  it("is labelled by its visible label and passes its attributes on", () => {
    render(<Input label="Email" name="email" type="email" maxLength={254} className="extra" />);

    const field = screen.getByLabelText("Email") as HTMLInputElement;

    expect([field.name, field.type, field.maxLength, field.className]).toEqual([
      "email",
      "email",
      254,
      "ui-input extra",
    ]);
  });

  it("can be named by aria-label alone, without a visible label", () => {
    const { container } = render(<Input aria-label="Password" type="password" />);

    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(container.querySelector("label")).toBeNull();
  });

  it("is valid and points to no message without an error", () => {
    render(<Input label="Email" />);

    const field = screen.getByLabelText("Email");

    expect(field.getAttribute("aria-invalid")).toBe("false");
    expect(field.hasAttribute("aria-describedby")).toBe(false);
    expect(document.querySelector(".ui-field__error")).toBeNull();
  });

  it("marks the field invalid and links the error shown under it", () => {
    render(<Input id="email" label="Email" error="Enter a valid email address." />);

    const field = screen.getByLabelText("Email");

    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe("email-error");
    expect(document.getElementById("email-error")?.textContent).toBe(
      "Enter a valid email address.",
    );
    expect(field.className).toBe("ui-input ui-input--error");
  });

  it("gives fields without an id their own ids, so each error is linked to its field", () => {
    render(
      <>
        <Input label="Email" error="Email is required." />
        <Input label="Password" error="Password is required." />
      </>,
    );

    const messages = ["Email", "Password"].map((label) => {
      const messageId = screen.getByLabelText(label).getAttribute("aria-describedby") ?? "";

      return document.getElementById(messageId)?.textContent;
    });

    expect(messages).toEqual(["Email is required.", "Password is required."]);
    expect(screen.getByLabelText("Email").id).not.toBe(screen.getByLabelText("Password").id);
  });
});
