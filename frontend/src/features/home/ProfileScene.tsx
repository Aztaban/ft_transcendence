import {
  confettiPieces,
  ID_PHOTO,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  spritePixels,
  STAMP,
  starPixels,
  STUDENT,
  STUDENT_CHEERING,
  textPixels,
} from "./pixelArt";
import Pixels from "./Pixels";

const FLOOR_TOP = SCENE_HEIGHT - 10;
const windowStars = starPixels(40, "#cfd6d6", 7).filter(
  (star) => star.x >= 86 && star.x < 108 && star.y >= 7 && star.y < 21,
);
const cardTitle = textPixels("42", 121, 10, "#111414");
const photo = spritePixels(ID_PHOTO, 125, 20);
const stamp = spritePixels(STAMP, 140, 23);
const standing = spritePixels(STUDENT, 105, 29);
const cheering = spritePixels(STUDENT_CHEERING, 105, 29);
const confetti = confettiPieces(26, 7);

// A badge on the card: a round seal with a white tick, one colour per stamp.
const seals = [
  { x: 140, color: "#00babc" },
  { x: 150, color: "#f5b301" },
  { x: 160, color: "#8a6cd1" },
];

// The student's 42 ID card gets stamped with three badges, then the student cheers (#57).
function ProfileScene() {
  return (
    <>
      <rect width={SCENE_WIDTH} height={FLOOR_TOP} fill="#1d2530" />
      <rect y={FLOOR_TOP} width={SCENE_WIDTH} height={10} fill="#2a3030" />
      <rect x={85} y={6} width={24} height={16} fill="#5b6363" />
      <rect x={86} y={7} width={22} height={14} fill="#141a22" />
      <Pixels pixels={windowStars} />
      <rect x={96} y={7} width={1} height={14} fill="#5b6363" />
      <rect x={117} y={7} width={63} height={35} fill="#0b0e12" />
      <rect x={118} y={8} width={60} height={32} fill="#f4f6f6" />
      <rect x={118} y={8} width={60} height={8} fill="#00babc" />
      <Pixels pixels={cardTitle} />
      <rect x={133} y={11} width={22} height={1} fill="#111414" />
      <rect x={133} y={13} width={14} height={1} fill="#111414" />
      <rect x={123} y={19} width={12} height={10} fill="#3b7cf6" />
      <Pixels pixels={photo} />
      <rect x={139} y={19} width={30} height={1} fill="#8a9090" />
      <rect x={139} y={22} width={22} height={1} fill="#8a9090" />
      <rect x={139} y={25} width={26} height={1} fill="#8a9090" />
      <rect x={123} y={32} width={12} height={4} fill="#cfd6d6" />
      {seals.map((seal, index) => (
        <g key={seal.color} className={`pixel-profile__seal pixel-profile__seal--${index + 1}`}>
          <rect x={seal.x + 1} y={29} width={5} height={1} fill={seal.color} />
          <rect x={seal.x} y={30} width={7} height={5} fill={seal.color} />
          <rect x={seal.x + 1} y={35} width={5} height={1} fill={seal.color} />
          <rect x={seal.x + 2} y={32} width={1} height={1} fill="#ffffff" />
          <rect x={seal.x + 3} y={33} width={1} height={1} fill="#ffffff" />
          <rect x={seal.x + 4} y={32} width={1} height={1} fill="#ffffff" />
          <rect x={seal.x + 5} y={31} width={1} height={1} fill="#ffffff" />
        </g>
      ))}
      <g className="pixel-profile__stamp">
        <Pixels pixels={stamp} />
      </g>
      <g className="pixel-profile__standing">
        <Pixels pixels={standing} />
      </g>
      <g className="pixel-profile__cheering">
        <Pixels pixels={cheering} />
      </g>
      <g className="pixel-profile__confetti">
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

export default ProfileScene;
