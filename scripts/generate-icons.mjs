// Renders the install icons from the favicon artwork. Run: node scripts/generate-icons.mjs
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const art = '<path d="M15 48 32 15 49 48ZM25 48 37 27 49 48" fill="#f4e8cc"/><circle cx="45" cy="16" r="5" fill="#d5aa54"/>';
// "any" icons keep the rounded tile; maskable icons fill the square and keep the art inside the 80% safe zone.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#285943"/>${art}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#285943"/><g transform="translate(32 32) scale(.72) translate(-32 -32)">${art}</g></svg>`;
const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const render = (svg, size, name) => sharp(Buffer.from(svg), { density: 72 * size / 64 }).resize(size, size).png().toFile(new URL(name, out).pathname);
await Promise.all([
  render(rounded, 192, 'icon-192.png'),
  render(rounded, 512, 'icon-512.png'),
  render(maskable, 512, 'maskable-512.png'),
  // iOS applies its own corner mask, so the touch icon is full-bleed too.
  render(maskable, 180, 'apple-touch-icon.png'),
]);
console.log('icons written to public/icons/');
