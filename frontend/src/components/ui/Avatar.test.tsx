import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Avatar, { initials } from "./Avatar";

afterEach(cleanup);

describe("Avatar", () => {
  it("takes the first letters of two names, or the first two letters of one", () => {
    expect(initials("Lenka Husarova")).toBe("LH");
    expect(initials("  dkolarov ")).toBe("DK");
  });

  // #763: an emoji is one character, never cut in half.
  it("keeps an emoji whole", () => {
    expect(initials("😀 Lenka")).toBe("😀L");
    expect(initials("Lenka 😀")).toBe("L😀");
    expect(initials("😀😀")).toBe("😀😀");
  });

  it("shows the picture as decoration when there is one", () => {
    const { container } = render(
      <Avatar name="Lenka" avatarUrl="/lenka.png" className="topbar__avatar" />,
    );
    const image = container.querySelector("img") as HTMLImageElement;

    expect(image.getAttribute("alt")).toBe("");
    expect(image.className).toBe("topbar__avatar");
  });

  it("shows the initials, hidden from screen readers, without a picture", () => {
    const { container } = render(<Avatar name="Lenka Husarova" avatarUrl={null} />);
    const avatar = container.firstElementChild as HTMLElement;

    expect(avatar.textContent).toBe("LH");
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.className).toBe("ui-avatar ui-avatar--initials");
  });
});
