// Renders the install icons from the game logo. Run: node scripts/generate-icons.mjs
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const TILE = '#24382e';
const logoPath = new URL('../public/assets/logo-english.png', import.meta.url).pathname;
const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

// The logo is wide with a transparent margin; trim it so the artwork, not the margin, sets its size.
const logo = await sharp(logoPath).trim().toBuffer();

/**
 * `width` is the logo's width as a share of the icon. "any" icons keep a rounded tile; maskable icons
 * fill the square, and the wide logo must stay inside the central 80% circle, so it is drawn smaller.
 */
async function render(size, name, { width, rounded }) {
  const art = await sharp(logo).resize({ width: Math.round(size * width) }).toBuffer();
  const radius = rounded ? Math.round(size * 14 / 64) : 0;
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${TILE}"/></svg>`);
  await sharp(tile).composite([{ input: art, gravity: 'centre' }]).png({ palette: true, quality: 90, effort: 10 }).toFile(new URL(name, out).pathname);
}

await Promise.all([
  render(192, 'icon-192.png', { width: .92, rounded: true }),
  render(512, 'icon-512.png', { width: .92, rounded: true }),
  render(512, 'maskable-512.png', { width: .7, rounded: false }),
  // iOS applies its own corner mask, so the touch icon is full-bleed; it only rounds the corners, so the logo can be larger.
  render(180, 'apple-touch-icon.png', { width: .86, rounded: false }),
]);
console.log('icons written to public/icons/');
