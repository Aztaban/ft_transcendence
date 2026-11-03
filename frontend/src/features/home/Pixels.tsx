import type { Pixel } from "./pixelArt";

// A sprite as SVG rectangles.
function Pixels({ pixels }: { pixels: Pixel[] }) {
  return pixels.map((pixel, index) => (
    <rect
      // The pixels of a sprite never change, and two stars may share a place.
      key={index}
      x={pixel.x}
      y={pixel.y}
      width={pixel.width}
      height={1}
      fill={pixel.color}
    />
  ));
}

export default Pixels;
