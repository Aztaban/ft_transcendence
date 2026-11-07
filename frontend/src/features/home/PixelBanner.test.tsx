import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { confettiPieces, planetPixels, spritePixels, textPixels } from "./pixelArt";
import PixelBanner from "./PixelBanner";

const rocket =
  "Pixel animation: a rocket dodges a space rock, passes a coffee mug and a duck astronaut, and reaches planet 42.";
const road = "Pixel animation: two cars ignore a hitchhiker, then a flying saucer picks them up.";
const desk =
  "Pixel animation: a student's program crashes with a segfault, then passes with 125 out of 100.";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function finishScene() {
  fireEvent.animationEnd(screen.getByTestId("pixel-banner-clock"));
}

describe("PixelBanner", () => {
  it("starts with the rocket", () => {
    render(<PixelBanner />);

    expect(screen.getByRole("img", { name: rocket })).toBeTruthy();
  });

  it("plays the scenes one after the other and starts again", () => {
    render(<PixelBanner />);

    finishScene();
    expect(screen.getByRole("img", { name: road })).toBeTruthy();

    finishScene();
    expect(screen.getByRole("img", { name: desk })).toBeTruthy();

    finishScene();
    expect(screen.getByRole("img", { name: rocket })).toBeTruthy();
  });

  it("gives every scene a clock as long as its animation", () => {
    const { container } = render(<PixelBanner />);
    // One length per scene, read by its animations and its clock in pixel-banner.css.
    const sceneLength = () =>
      (container.querySelector(".pixel-banner") as HTMLElement).style.getPropertyValue(
        "--scene-length",
      );

    expect(sceneLength()).toBe("16s");

    finishScene();
    expect(sceneLength()).toBe("14s");
  });

  it("goes to the still rocket when reduced motion is turned on while it plays", () => {
    const query = {
      matches: false,
      listeners: new Set<() => void>(),
      addEventListener: (_: string, listener: () => void) => query.listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => query.listeners.delete(listener),
    };

    vi.stubGlobal("matchMedia", () => query);
    render(<PixelBanner />);
    finishScene();
    expect(screen.getByRole("img", { name: road })).toBeTruthy();

    act(() => {
      query.matches = true;
      query.listeners.forEach((listener) => listener());
    });

    expect(screen.getByRole("img", { name: rocket })).toBeTruthy();
    expect(screen.queryByTestId("pixel-banner-clock")).toBeNull();
  });

  it("pauses and plays the animation", () => {
    const { container } = render(<PixelBanner />);
    const banner = container.firstElementChild as HTMLElement;

    fireEvent.click(screen.getByRole("button", { name: "Pause animation" }));
    expect(banner.className).toBe("pixel-banner pixel-banner--paused");

    fireEvent.click(screen.getByRole("button", { name: "Play animation" }));
    expect(banner.className).toBe("pixel-banner");
  });
});

describe("pixelArt", () => {
  it("turns a sprite into runs of one colour, skipping transparent pixels", () => {
    expect(spritePixels("\nWW.K", 10, 20)).toEqual([
      { x: 10, y: 20, width: 2, color: "#ffffff" },
      { x: 13, y: 20, width: 1, color: "#111414" },
    ]);
  });

  it("writes a letter from the small font", () => {
    expect(textPixels("I", 0, 0, "#111414")).toHaveLength(9);
  });

  it("draws one row of the planet for every line of its height", () => {
    expect(planetPixels(19)).toHaveLength(39);
  });

  it("gives every confetti piece its own place", () => {
    const pieces = confettiPieces(26, 42);

    expect(new Set(pieces.map((piece) => `${piece.x}-${piece.y}`)).size).toBe(26);
  });
});
