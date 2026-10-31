import {
  CAR,
  CLOUD,
  HIKER,
  HIKER_THUMB_UP,
  SAUCER,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  spritePixels,
  starPixels,
  textPixels,
} from "./pixelArt";
import Pixels from "./Pixels";

const GROUND_TOP = SCENE_HEIGHT - 12;
const stars = starPixels(26, "#5b6363", 11, GROUND_TOP);
const clouds = [...spritePixels(CLOUD, 96, 9), ...spritePixels(CLOUD, 168, 5)];
const sign = textPixels("42", 149, 15, "#ffffff");
const saucer = spritePixels(SAUCER, 109, 4);
const hiker = spritePixels(HIKER, 116, 23);
const hikerThumbUp = spritePixels(HIKER_THUMB_UP, 116, 23);
const redCar = spritePixels(CAR, 0, 34);
const blueCar = spritePixels(CAR.replace(/R/g, "B"), 0, 34);
const dots = textPixels("...", 109, 13, "#111414");
const question = textPixels("?", 113, 12, "#e5484d");
const dashes = Array.from({ length: 12 }, (_, index) => 4 + index * 16);
const beam = Array.from({ length: 9 }, (_, index) => index);

// Two cars ignore a hitchhiker at the 42 sign, then a flying saucer picks them up.
function RoadScene() {
  return (
    <>
      <Pixels pixels={stars} />
      <Pixels pixels={clouds} />
      <rect y={GROUND_TOP} width={SCENE_WIDTH} height={12} fill="#2a3030" />
      <rect y={GROUND_TOP} width={SCENE_WIDTH} height={1} fill="#5b6363" />
      {dashes.map((x) => (
        <rect key={x} x={x} y={44} width={8} height={1} fill="#f5b301" />
      ))}
      <rect x={152} y={22} width={2} height={16} fill="#5b6363" />
      <rect x={146} y={13} width={14} height={10} fill="#00686a" />
      <Pixels pixels={sign} />
      <g className="pixel-road__saucer">
        <Pixels pixels={saucer} />
      </g>
      <g className="pixel-road__beam">
        {beam.map((step) => (
          <rect
            key={step}
            x={117 - step}
            y={12 + step * 3}
            width={10 + step * 2}
            height={3}
            fill="#f5b301"
            opacity={0.45}
          />
        ))}
      </g>
      <g className="pixel-road__hiker">
        <g className="pixel-blink pixel-blink--slow">
          <Pixels pixels={hiker} />
        </g>
        <g className="pixel-blink pixel-blink--slow pixel-blink--second">
          <Pixels pixels={hikerThumbUp} />
        </g>
      </g>
      <g className="pixel-road__dots">
        <rect x={108} y={12} width={15} height={8} fill="#ffffff" />
        <Pixels pixels={dots} />
      </g>
      <g className="pixel-road__question">
        <rect x={110} y={11} width={10} height={8} fill="#ffffff" />
        <Pixels pixels={question} />
      </g>
      <g className="pixel-road__car pixel-road__car--first">
        <Pixels pixels={redCar} />
      </g>
      <g className="pixel-road__car pixel-road__car--second">
        <Pixels pixels={blueCar} />
      </g>
    </>
  );
}

export default RoadScene;
