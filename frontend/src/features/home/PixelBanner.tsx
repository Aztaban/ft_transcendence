import { useState, useSyncExternalStore, type ComponentType, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import DeskScene from "./DeskScene";
import { SCENE_HEIGHT, SCENE_WIDTH } from "./pixelArt";
import RoadScene from "./RoadScene";
import RocketScene from "./RocketScene";
import "../../styles/pixel-banner.css";

interface Scene {
  Art: ComponentType;
  // A key of the "home" texts in src/i18n/locales.
  label: string;
  // Must match the animation length of the scene in pixel-banner.css.
  seconds: number;
}

const scenes: Scene[] = [
  { Art: RocketScene, label: "home.animationRocket", seconds: 16 },
  { Art: RoadScene, label: "home.animationRoad", seconds: 14 },
  { Art: DeskScene, label: "home.animationDesk", seconds: 14 },
];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION);

  query?.addEventListener("change", onChange);

  return () => query?.removeEventListener("change", onChange);
}

function isReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION).matches ?? false;
}

// The Home banner's animation: one pixel scene after the other, in a loop. It is decorative, and
// a pause button stops it, because moving content longer than 5 seconds needs one (WCAG 2.2.2).
// The clock is a CSS animation as long as the scene, so pausing stops the change of scene too.
// With "reduce motion" on, also when it is turned on later, it shows a still rocket: no clock,
// no change of scene, and the CSS stops the movement and hides the button.
function PixelBanner() {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const isStill = useSyncExternalStore(subscribeToReducedMotion, isReducedMotion);
  const { Art, label, seconds } = scenes[isStill ? 0 : sceneIndex];

  return (
    <div
      className={["pixel-banner", isPaused ? "pixel-banner--paused" : ""].join(" ").trim()}
      // The scene's length, for its animations and the clock: set only here (#713).
      style={{ "--scene-length": `${seconds}s` } as CSSProperties}
    >
      {/* The key restarts every animation when the scene changes. */}
      <svg
        key={label}
        className="pixel-banner__scene"
        viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
        role="img"
        aria-label={t(label)}
        preserveAspectRatio="xMaxYMid meet"
        shapeRendering="crispEdges"
      >
        <Art />
      </svg>

      {!isStill && (
        <span
          key={`clock-${label}`}
          className="pixel-banner__clock"
          data-testid="pixel-banner-clock"
          onAnimationEnd={() => setSceneIndex((index) => (index + 1) % scenes.length)}
        />
      )}

      <button
        className="pixel-banner__pause"
        type="button"
        aria-label={t(isPaused ? "home.playAnimation" : "home.pauseAnimation")}
        onClick={() => setIsPaused((paused) => !paused)}
      >
        <span aria-hidden="true">{isPaused ? "▶" : "II"}</span>
      </button>
    </div>
  );
}

export default PixelBanner;
