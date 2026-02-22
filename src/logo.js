// Default logo generator: SVG design → rasterize → PNG
//
// SVG design reference (100x100 viewBox):
// <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
//   <rect x="24" y="38" width="52" height="50" rx="6" fill="white"/>
//   <path d="M 35 38 A 15 15 0 0 1 65 38" fill="none" stroke="white" stroke-width="6"/>
// </svg>
//
// The shapes are rasterized to a pixel buffer and output as RGBA PNG.

const { createRGBAPNG } = require('./png');

// SVG shape definitions (coordinates on 100x100 grid)
const LOGO_SHAPES = [
  { type: 'roundedRect', x: 24, y: 38, w: 52, h: 50, rx: 6 },
  { type: 'arc', cx: 50, cy: 38, outerR: 17, innerR: 11, half: 'top' },
];

function createDefaultLogoPNG(size) {
  const pixels = new Uint8Array(size * size * 4);
  const s = size / 100;

  for (const shape of LOGO_SHAPES) {
    if (shape.type === 'roundedRect') {
      rasterRoundedRect(pixels, size, s, shape);
    } else if (shape.type === 'arc') {
      rasterArc(pixels, size, s, shape);
    }
  }

  return createRGBAPNG(size, size, pixels);
}

function setWhitePixel(pixels, stride, x, y) {
  if (x < 0 || x >= stride || y < 0 || y >= stride) return;
  const idx = (y * stride + x) * 4;
  pixels[idx] = 255;
  pixels[idx + 1] = 255;
  pixels[idx + 2] = 255;
  pixels[idx + 3] = 255;
}

function rasterRoundedRect(pixels, size, s, shape) {
  const x = shape.x * s, y = shape.y * s;
  const w = shape.w * s, h = shape.h * s;
  const r = shape.rx * s;

  for (let py = Math.floor(y); py <= Math.ceil(y + h); py++) {
    for (let px = Math.floor(x); px <= Math.ceil(x + w); px++) {
      const cx = px + 0.5, cy = py + 0.5;
      if (cx < x || cx > x + w || cy < y || cy > y + h) continue;

      let inside = true;
      if (cx < x + r && cy < y + r) {
        inside = Math.hypot(cx - (x + r), cy - (y + r)) <= r;
      } else if (cx > x + w - r && cy < y + r) {
        inside = Math.hypot(cx - (x + w - r), cy - (y + r)) <= r;
      } else if (cx < x + r && cy > y + h - r) {
        inside = Math.hypot(cx - (x + r), cy - (y + h - r)) <= r;
      } else if (cx > x + w - r && cy > y + h - r) {
        inside = Math.hypot(cx - (x + w - r), cy - (y + h - r)) <= r;
      }

      if (inside) setWhitePixel(pixels, size, px, py);
    }
  }
}

function rasterArc(pixels, size, s, shape) {
  const cx = shape.cx * s, cy = shape.cy * s;
  const outerR = shape.outerR * s, innerR = shape.innerR * s;

  const yStart = Math.max(0, Math.floor(cy - outerR));
  const yEnd = shape.half === 'top' ? Math.ceil(cy) : Math.min(size, Math.ceil(cy + outerR));
  const xStart = Math.max(0, Math.floor(cx - outerR));
  const xEnd = Math.min(size, Math.ceil(cx + outerR));

  for (let py = yStart; py < yEnd; py++) {
    for (let px = xStart; px < xEnd; px++) {
      const dist = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
      if (dist >= innerR && dist <= outerR) {
        setWhitePixel(pixels, size, px, py);
      }
    }
  }
}

module.exports = { createDefaultLogoPNG };
