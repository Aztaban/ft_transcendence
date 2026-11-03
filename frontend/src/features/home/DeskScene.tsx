import {
  confettiPieces,
  CLOUD,
  RUBBER_DUCK,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  spritePixels,
  STUDENT,
  STUDENT_CHEERING,
  STUDENT_HEAD_DOWN,
  STUDENT_TYPING,
  textPixels,
} from "./pixelArt";
import Pixels from "./Pixels";

const FLOOR_TOP = SCENE_HEIGHT - 10;
const posterText = [
  ...textPixels("42", 112, 9, "#111414"),
  ...textPixels("EVA", 110, 15, "#111414"),
];
const prompt = textPixels("$ MAKE", 130, 12, "#2fbf71");
const crash = [
  ...textPixels("SEGFAULT", 131, 14, "#ffffff"),
  ...textPixels("!!!", 141, 22, "#ffffff"),
];
const pass = [
  ...textPixels("125/100", 133, 14, "#ffffff"),
  ...textPixels("PASS", 138, 22, "#ffffff"),
];
const duck = spritePixels(RUBBER_DUCK, 102, 29);
const rainCloud = spritePixels(CLOUD, 94, 4);
const typing = spritePixels(STUDENT, 86, 23);
const typingOtherHand = spritePixels(STUDENT_TYPING, 86, 23);
const headDown = spritePixels(STUDENT_HEAD_DOWN, 86, 23);
const cheering = spritePixels(STUDENT_CHEERING, 86, 23);
const raindrops = [0, 1, 2, 3];
const confetti = confettiPieces(26, 42);

// A student's program crashes with a segfault, the rain cloud comes, then it passes with 125/100.
function DeskScene() {
  return (
    <>
      <rect width={SCENE_WIDTH} height={FLOOR_TOP} fill="#1d2530" />
      <rect y={FLOOR_TOP} width={SCENE_WIDTH} height={10} fill="#2a3030" />
      <rect x={108} y={6} width={16} height={16} fill="#00babc" />
      <Pixels pixels={posterText} />
      <rect x={168} y={8} width={20} height={16} fill="#5b6363" />
      <rect x={169} y={9} width={18} height={14} fill="#141a22" />
      <rect x={181} y={11} width={3} height={3} fill="#f5b301" />
      <rect x={178} y={9} width={1} height={14} fill="#5b6363" />
      <rect x={86} y={34} width={96} height={3} fill="#8a5a2b" />
      <rect x={90} y={37} width={3} height={13} fill="#5b3a1b" />
      <rect x={174} y={37} width={3} height={13} fill="#5b3a1b" />
      <rect x={80} y={22} width={3} height={18} fill="#5b6363" />
      <rect x={80} y={38} width={15} height={3} fill="#5b6363" />
      <rect x={86} y={41} width={3} height={9} fill="#5b6363" />
      <rect x={126} y={9} width={40} height={22} fill="#0b0e12" />
      <rect x={142} y={31} width={8} height={3} fill="#5b6363" />
      <rect x={136} y={33} width={20} height={1} fill="#5b6363" />
      <g className="pixel-desk__prompt">
        <Pixels pixels={prompt} />
        <rect
          className="pixel-blink pixel-blink--slow"
          x={130}
          y={19}
          width={3}
          height={5}
          fill="#2fbf71"
        />
      </g>
      <g className="pixel-desk__crash">
        <rect x={127} y={10} width={38} height={20} fill="#b42318" />
        <Pixels pixels={crash} />
      </g>
      <g className="pixel-desk__pass">
        <rect x={127} y={10} width={38} height={20} fill="#0d6b45" />
        <Pixels pixels={pass} />
      </g>
      <rect x={168} y={28} width={6} height={6} fill="#ffffff" />
      <rect x={174} y={29} width={2} height={3} fill="#ffffff" />
      <rect x={169} y={29} width={4} height={1} fill="#8a5a2b" />
      <g className="pixel-desk__steam">
        <rect x={170} y={24} width={1} height={2} fill="#8a9090" />
        <rect x={172} y={22} width={1} height={2} fill="#8a9090" />
      </g>
      <Pixels pixels={duck} />
      <g className="pixel-desk__typing">
        <g className="pixel-blink pixel-blink--fast">
          <Pixels pixels={typing} />
        </g>
        <g className="pixel-blink pixel-blink--fast pixel-blink--second">
          <Pixels pixels={typingOtherHand} />
        </g>
      </g>
      <g className="pixel-desk__head-down">
        <Pixels pixels={headDown} />
      </g>
      <g className="pixel-desk__cheering">
        <Pixels pixels={cheering} />
      </g>
      <g className="pixel-desk__rain">
        <Pixels pixels={rainCloud} />
        <g className="pixel-desk__drops">
          {raindrops.map((drop) => (
            <rect
              key={drop}
              x={96 + drop * 3}
              y={8 + (drop % 2) * 2}
              width={1}
              height={2}
              fill="#3b7cf6"
            />
          ))}
        </g>
      </g>
      <g className="pixel-desk__confetti">
        {confetti.map((piece) => (
          <rect
            key={`${piece.x}-${piece.y}`}
            x={piece.x}
            y={piece.y}
            width={2}
            height={2}
            fill={piece.color}
            style={{ animationDelay: `${piece.delay}s` }}
          />
        ))}
      </g>
    </>
  );
}

export default DeskScene;
