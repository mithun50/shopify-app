'use strict';

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Copy an image file to dest as PNG, optionally resizing.
 * Tries sharp first, then ImageMagick, then raw copy.
 */
async function copyAsPng(src, dest, size) {
  const ext = path.extname(src).toLowerCase();
  const needsConvert = ext !== '.png';
  const needsResize = !!size;

  // If already PNG and no resize needed, just copy
  if (!needsConvert && !needsResize) {
    await fs.copy(src, dest);
    return;
  }

  // Try sharp (optional dependency)
  try {
    const sharp = require('sharp');
    let pipeline = sharp(src);
    if (needsResize) {
      pipeline = pipeline.resize(size, size, { fit: 'cover' });
    }
    await pipeline.png().toFile(dest);
    return;
  } catch {}

  // Try ImageMagick
  const resize = needsResize ? `-resize ${size}x${size}!` : '';
  try {
    execSync(`magick "${src}" ${resize} "${dest}"`, { stdio: 'pipe' });
    return;
  } catch {}
  try {
    execSync(`convert "${src}" ${resize} "${dest}"`, { stdio: 'pipe' });
    return;
  } catch {}

  // Fallback — copy as-is
  await fs.copy(src, dest);
}

module.exports = { copyAsPng };
