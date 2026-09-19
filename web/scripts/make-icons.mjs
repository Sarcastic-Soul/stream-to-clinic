// Regenerates the app icons from one SVG mark: a water drop carrying a health cross.
// Run by hand after changing the design: `node scripts/make-icons.mjs`. Output is committed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SKY = "#0369a1";

// `inset` shrinks the mark so maskable icons keep it inside the 80% safe zone.
const svg = ({ rounded, inset }) => {
  const scale = 1 - inset;
  const offset = (512 * inset) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${SKY}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M256 72C256 72 128 216 128 312a128 128 0 0 0 256 0C384 216 256 72 256 72Z" fill="#fff"/>
    <path d="M240 256h32v48h48v32h-48v48h-32v-48h-48v-32h48Z" fill="${SKY}"/>
  </g>
</svg>
`;
};

const root = join(import.meta.dirname, "..");
const icon = svg({ rounded: true, inset: 0 });
const maskable = svg({ rounded: false, inset: 0.2 });

writeFileSync(join(root, "src/app/icon.svg"), icon);
const png = (source, size, file) => sharp(Buffer.from(source)).resize(size, size).png().toFile(join(root, file));
await Promise.all([
  png(icon, 192, "public/icons/icon-192.png"),
  png(icon, 512, "public/icons/icon-512.png"),
  png(maskable, 512, "public/icons/icon-maskable-512.png"),
  png(svg({ rounded: false, inset: 0.1 }), 180, "src/app/apple-icon.png"),
]);
console.log("Icons written");
