import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import InfoNotice from "./InfoNotice";

afterEach(cleanup);

describe("InfoNotice", () => {
  it("is a note inside the page, not a landmark of its own", () => {
    render(<InfoNotice>The Hitchhiker evaluation must be the last one.</InfoNotice>);

    expect(screen.getByRole("note").textContent).toContain(
      "The Hitchhiker evaluation must be the last one.",
    );
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
