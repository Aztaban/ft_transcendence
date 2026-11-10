import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import TextArea from "./TextArea";

afterEach(cleanup);

function Note({ start = "" }: { start?: string }) {
  const [value, setValue] = useState(start);

  return (
    <TextArea
      label="Note for the Hitchhiker"
      value={value}
      maxLength={100}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe("TextArea", () => {
  it("is labelled and shows how many characters are used", () => {
    render(<Note />);

    const box = screen.getByRole("textbox", { name: "Note for the Hitchhiker" });

    fireEvent.change(box, { target: { value: "Hello" } });

    expect((box as HTMLTextAreaElement).maxLength).toBe(100);
    expect(screen.getByText("5 / 100")).toBeTruthy();
    expect(box.getAttribute("aria-describedby")).toBe(screen.getByText("5 / 100").id);
  });

  it("counts an emoji as one character", () => {
    render(<Note start="Hi 😀" />);

    expect(screen.getByText("4 / 100")).toBeTruthy();
  });

  it("tells screen readers how many characters are left only near the limit", () => {
    render(<Note start={"a".repeat(50)} />);

    const live = document.querySelector('[aria-live="polite"]') as HTMLElement;

    expect(live.textContent).toBe("");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a".repeat(99) } });

    expect(live.textContent).toBe("1 character left");
  });
});
