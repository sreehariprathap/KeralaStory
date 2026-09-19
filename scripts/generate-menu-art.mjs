// Renders the menu background from the Kerala story map. Run: node scripts/generate-menu-art.mjs
// The source is an 8 MB PNG; the menu shows it at 20% opacity, so a small WebP is indistinguishable.
import sharp from 'sharp';

const source = new URL('../public/assets/kerala-story-map.png', import.meta.url).pathname;
const target = new URL('../public/assets/menu-map.webp', import.meta.url).pathname;
const info = await sharp(source).resize(1100, 1100, { fit: 'inside' }).webp({ quality: 45 }).toFile(target);
console.log(`menu-map.webp written (${Math.round(info.size / 1024)} KB)`);
