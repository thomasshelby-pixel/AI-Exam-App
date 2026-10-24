import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(root, "assets");
await mkdir(dir, { recursive: true });
for (const [source, output] of [["icon.svg","icon.png"],["brand-mark.svg","adaptive-icon.png"],["brand-mark-mono.svg","monochrome-icon.png"],["splash.svg","splash.png"]]) {
  await sharp(resolve(dir, source), { density: 192 }).resize(1024, 1024, { fit: "contain" }).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(resolve(dir, output));
  process.stdout.write(`Generated assets/${output}\n`);
}