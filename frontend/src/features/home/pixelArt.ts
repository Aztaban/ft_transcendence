// Hand-drawn pixel art for the Home banner: one character is one pixel, "." is transparent.
// Every scene is night, so the welcome text stays readable over it.

export const SCENE_WIDTH = 190;
export const SCENE_HEIGHT = 50;

export interface Pixel {
  x: number;
  y: number;
  width: number;
  color: string;
}

const colors: Record<string, string> = {
  A: "#5b6363",
  B: "#3b7cf6",
  G: "#8a9090",
  K: "#111414",
  L: "#cfd6d6",
  N: "#8a5a2b",
  O: "#ff8a3d",
  R: "#e5484d",
  S: "#f2c09a",
  T: "#00babc",
  W: "#ffffff",
  Y: "#f5b301",
};

export const ROCKET = `
......WW............
....WWWWWW..........
KKKWWWWWWWWRR.......
KRRWWTTTWWWWRRR.....
.KRWWTSTWWWWWRRRR...
.KRWWTTTWWWWRRR.....
KRRWWWWWWWWRR.......
KKKWWWWWWW..........
....WWWW............`;

export const FLAME_SMALL = `
..OOO
OOYYO
OYYYY
OOYYO
..OOO`;

export const FLAME_LARGE = `
.OOO.
OYYYO
YYYYY
OYYYO
.OOO.`;

export const DUCK = `
...LLLLLL...
..L..YYY.L..
..L.YKYYOL..
..L.YYYYOL..
...LLLLLL...
..YYYYYYY...
.YYYYYYYYY..
..YYYYYYY...
...Y...Y....`;

export const ROCK = `
...AAAAA...
..AAGGGAAA.
.AAGGAAGGA.
AAGAAAAGGAA
AGGAAGAAGGA
.AAGGGGAAA.
...AAAAA...`;

export const MUG = `
.L.L....
..L.....
WWWWWW..
WNNNNWWW
WWWWWW.W
WWWWWWWW
WWWWWW..
.K...K..`;

export const HIKER = `
....KKKK....
...KKKKKK...
...KSSSSK...
...SKSKSK...
...SSSSSK...
....SSSS....
...TTTTTTNNN
SSSYYYYTTNNN
S..YYYYYYNNN
...YYYYYSNNN
...YYYY.SNNN
....BBBB....
....BB.BB...
....BB.BB...
...KKK.KKK..`;

export const HIKER_THUMB_UP = HIKER.replace(
  "SSSYYYYTTNNN\nS..YYYYYYNNN",
  "SS.YYYYTTNNN\nSSSYYYYYYNNN",
);

export const CAR = `
.........RRRRRRRR...........
.......RRLLLRLLLLRR.........
......RRLLLLRLLLLLRR........
.RRRRRRRRRRRRRRRRRRRRRRRRR..
RRRRRRRRRRRRRRRRRRRRRRRRRRR.
YRRRRRRRRRRRRRRRRRRRRRRRRRRK
RRRRRRRRRRRRRRRRRRRRRRRRRRRK
RRRKKKKRRRRRRRRRRRRRKKKKRRRR
...KGGK.............KGGK....
....KK...............KK.....`;

export const SAUCER = `
..........TTTTTT..........
........TTWWTTTTTT........
.......TTWWTTTTTTTT.......
....GGGGGGGGGGGGGGGGGG....
..GGLLLLLLLLLLLLLLLLLLGG..
GGGGYGGGGYGGGGYGGGGYGGGGGG
..GGGGGGGGGGGGGGGGGGGGGG..
.....AAAAAAAAAAAAAAAA.....`;

export const CLOUD = `
...AAAA....
.AAAAAAAA..
AAAAAAAAAAA`;

export const STUDENT = `
..KKKKK....
.KKKKKKK...
.KKSSSSS...
.KSSSKSK...
.KSSSSSS...
..SSSSS....
.TTTTTT....
TTTTTTTT...
TTTTTTTSSSS
TTTTTTTT...
TTTTTTT....`;

export const STUDENT_TYPING = STUDENT.replace(
  "TTTTTTTSSSS\nTTTTTTTT...",
  "TTTTTTTT...\nTTTTTTTSSSS",
);

export const STUDENT_HEAD_DOWN = `
...........
...........
...........
...........
...........
.......KKKK
.TTTTTKKKKK
TTTTTTTKSSS
TTTTTTTTSSS
TTTTTTTT...
TTTTTTT....`;

export const STUDENT_CHEERING = `
S.........S
S.KKKKK...S
SKKKKKKK..S
SKKSSSSS.SS
SKSSSKSK.S.
.SKSSSSS.S.
.SSSSSSSS..
..TTTTTT...
..TTTTTTT..
..TTTTTTT..
..TTTTTT...`;

export const RUBBER_DUCK = `
..YYY...
..YKY.O.
.YYYYYOO
YYYYYYY.
.YYYYY..`;

// A 3×5 font, read row by row, for the few letters the scenes write.
const font: Record<string, string> = {
  " ": "000000000000000",
  "!": "010010010000010",
  $: "011110010011110",
  ".": "000000000000010",
  "/": "001001010100100",
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "111001111100111",
  "4": "101101111001001",
  "5": "111100111001111",
  "?": "110001010000010",
  A: "010101111101101",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  K: "101110100110101",
  L: "100100100100111",
  M: "101111111101101",
  O: "010101101101010",
  P: "110101110100100",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
};

// One rectangle per run of the same colour, so a sprite stays a short list.
export function spritePixels(art: string, left = 0, top = 0): Pixel[] {
  return art
    .trim()
    .split("\n")
    .flatMap((line, row) => {
      const pixels: Pixel[] = [];

      for (let start = 0, end = 0; start < line.length; start = end) {
        while (end < line.length && line[end] === line[start]) {
          end += 1;
        }

        if (line[start] !== ".") {
          pixels.push({
            x: left + start,
            y: top + row,
            width: end - start,
            color: colors[line[start]],
          });
        }
      }

      return pixels;
    });
}

export function textPixels(text: string, left: number, top: number, color: string): Pixel[] {
  return [...text].flatMap((letter, index) =>
    [...font[letter]].flatMap((bit, position) =>
      bit === "1"
        ? [
            {
              x: left + index * 4 + (position % 3),
              y: top + Math.floor(position / 3),
              width: 1,
              color,
            },
          ]
        : [],
    ),
  );
}

// The planet: a disc drawn row by row, with darker bands.
export function planetPixels(radius: number): Pixel[] {
  const rows: Pixel[] = [];

  for (let y = -radius; y <= radius; y += 1) {
    const half = Math.floor(Math.sqrt(radius * radius - y * y));

    rows.push({
      x: radius - half,
      y: y + radius,
      width: half * 2,
      color: (y + radius) % 11 > 2 ? "#00babc" : "#00989a",
    });
  }

  return rows;
}

// Stars at fixed places, the same on every render.
export function starPixels(
  count: number,
  color: string,
  seed: number,
  height = SCENE_HEIGHT,
): Pixel[] {
  let value = seed;

  function next(limit: number) {
    value = (value * 1103515245 + 12345) % 2147483648;

    return Math.floor((value / 2147483648) * limit);
  }

  return Array.from({ length: count }, () => ({
    x: next(SCENE_WIDTH),
    y: next(height),
    width: 1,
    color,
  }));
}

// Confetti at fixed places: `delay` keeps the pieces from falling in step.
export function confettiPieces(count: number, seed: number) {
  const pieceColors = ["#00babc", "#f5b301", "#e5484d", "#8a6cd1", "#2fbf71"];

  return starPixels(count, "", seed).map((star, index) => ({
    x: 70 + (star.x % 115),
    y: -2 - (star.y % 30),
    color: pieceColors[index % pieceColors.length],
    delay: -(index % 7) / 5,
  }));
}
