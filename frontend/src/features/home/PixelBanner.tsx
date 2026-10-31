import { useState, type ComponentType } from "react";
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

// The Home banner's animation: one pixel scene after the other, in a loop. It is decorative, and
// a pause button stops it, because moving content longer than 5 seconds needs one (WCAG 2.2.2).
// The clock is a CSS animation as long as the scene, so pausing stops the change of scene too.
// With "reduce motion" on, the CSS stops the clock, shows a still rocket and hides the button.
function PixelBanner() {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const { Art, label, seconds } = scenes[sceneIndex];

  return (
    <div className={["pixel-banner", isPaused ? "pixel-banner--paused" : ""].join(" ").trim()}>
      {/* The key restarts every animation when the scene changes. */}
      <svg
        key={label}
        className="pixel-banner__scene"
        viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
        role="img"
        aria-label={t(label)}
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
      >
        <Art />
      </svg>

      <span
        key={`clock-${label}`}
        className="pixel-banner__clock"
        data-testid="pixel-banner-clock"
        style={{ animationDuration: `${seconds}s` }}
        onAnimationEnd={() => setSceneIndex((index) => (index + 1) % scenes.length)}
      />

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
