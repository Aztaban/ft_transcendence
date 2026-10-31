import {
  DUCK,
  FLAME_LARGE,
  FLAME_SMALL,
  MUG,
  planetPixels,
  ROCK,
  ROCKET,
  SCENE_WIDTH,
  spritePixels,
  starPixels,
  textPixels,
} from "./pixelArt";
import Pixels from "./Pixels";

const farStars = starPixels(32, "#5b6363", 7);
const nearStars = starPixels(16, "#ffffff", 42);
const rocket = spritePixels(ROCKET, 90, 18);
const smallFlame = spritePixels(FLAME_SMALL, 85, 20);
const largeFlame = spritePixels(FLAME_LARGE, 85, 20);
const rock = spritePixels(ROCK, 0, 8);
const mug = spritePixels(MUG, 0, 6);
const duck = spritePixels(DUCK, 0, 30);
const greeting = textPixels("HI!", 3, 20, "#111414");
const planet = [
  ...planetPixels(19),
  ...textPixels("42", 15, 13, "#111414"),
  ...textPixels("OK", 15, 21, "#111414"),
];

// A rocket dodges a duck astronaut, a space rock and a coffee mug on its way to planet 42.
function RocketScene() {
  return (
    <>
      <g className="pixel-rocket__stars pixel-rocket__stars--far">
        <Pixels pixels={farStars} />
        <g transform={`translate(${SCENE_WIDTH} 0)`}>
          <Pixels pixels={farStars} />
        </g>
      </g>
      <g className="pixel-rocket__stars pixel-rocket__stars--near">
        <Pixels pixels={nearStars} />
        <g transform={`translate(${SCENE_WIDTH} 0)`}>
          <Pixels pixels={nearStars} />
        </g>
      </g>
      <g className="pixel-rocket__planet">
        <Pixels pixels={planet} />
      </g>
      <g className="pixel-rocket__flag">
        <rect width={1} height={9} fill="#ffffff" />
        <rect x={1} width={7} height={5} fill="#f5b301" />
      </g>
      <g className="pixel-rocket__rock">
        <Pixels pixels={rock} />
      </g>
      <g className="pixel-rocket__mug">
        <Pixels pixels={mug} />
      </g>
      <g className="pixel-rocket__duck">
        <Pixels pixels={duck} />
        <rect x={-2} y={19} width={22} height={8} fill="#ffffff" />
        <Pixels pixels={greeting} />
      </g>
      <g className="pixel-rocket__rocket">
        <Pixels pixels={rocket} />
        <g className="pixel-blink pixel-blink--fast">
          <Pixels pixels={smallFlame} />
        </g>
        <g className="pixel-blink pixel-blink--fast pixel-blink--second">
          <Pixels pixels={largeFlame} />
        </g>
      </g>
    </>
  );
}

export default RocketScene;
