import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PersonAvatar, { initials } from "./PersonAvatar";

describe("initials", () => {
  it("uses the first letter of the first two words, or the first two letters", () => {
    expect(initials("Lenka Husarova")).toBe("LH");
    expect(initials("dkolarov")).toBe("DK");
  });

  it("keeps an emoji whole", () => {
    expect(initials("😀 Lenka")).toBe("😀L");
    expect(initials("Lenka 😀")).toBe("L😀");
    expect(initials("😀😀")).toBe("😀😀");
  });
});

describe("PersonAvatar", () => {
  it("shows the initials when there is no picture", () => {
    render(<PersonAvatar name="😀 Lenka" avatarUrl={null} className="topbar__avatar" />);

    expect(screen.getByText("😀L")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
