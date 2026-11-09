import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Card from "./Card";

afterEach(cleanup);

describe("Card", () => {
  it("wraps its content in the card style and keeps extra classes and attributes", () => {
    render(
      <Card className="design-system__card" aria-labelledby="card-title" data-testid="card">
        <h3 id="card-title">Input · Checkbox</h3>
      </Card>,
    );

    const card = screen.getByTestId("card");

    expect(card.className).toBe("ui-card design-system__card");
    expect(card.getAttribute("aria-labelledby")).toBe("card-title");
    expect(card.textContent).toBe("Input · Checkbox");
  });

  it("has only the card style without extra classes", () => {
    render(<Card data-testid="card">Text</Card>);

    expect(screen.getByTestId("card").className).toBe("ui-card");
  });
});
