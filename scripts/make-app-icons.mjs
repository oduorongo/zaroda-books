/**
 * Builds the installable-app icons from public/zaroda-mark.png.
 *
 * The mark is white with transparency, so every icon gets the navy behind it —
 * a transparent icon renders as a white-on-white smudge on a light home screen
 * and is unreadable on iOS, which flattens transparency onto white.
 *
 * Re-run after changing the mark:
 *   node scripts/make-app-icons.mjs
 */
import { createRequire } from "node:module";

// sharp arrives as a Next.js dependency rather than one of ours, and ships CJS.
const sharp = createRequire(import.meta.url)("sharp");

const INK = { r: 0x10, g: 0x22, b: 0x3f, alpha: 1 };
const SRC = "public/zaroda-mark.png";

/**
 * `inset` is how much of the canvas the mark leaves empty. A maskable icon
 * can be cropped to a circle by the launcher, so its mark sits inside the
 * 80% safe zone with room to spare.
 */
async function icon(size, inset, out) {
  const markSize = Math.round(size * (1 - inset));
  const mark = await sharp(SRC)
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: INK },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(out);

  console.log(`${out}  ${size}x${size}`);
}

await icon(192, 0.22, "public/icon-192.png");
await icon(512, 0.22, "public/icon-512.png");
// Launchers crop maskable icons hard, so this one keeps well clear of the edge.
await icon(512, 0.40, "public/icon-512-maskable.png");
await icon(180, 0.18, "public/apple-touch-icon.png");
