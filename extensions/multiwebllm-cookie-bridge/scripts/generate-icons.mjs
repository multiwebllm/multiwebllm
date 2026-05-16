import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "icons");
mkdirSync(iconsDir, { recursive: true });

// Minimal valid 16x16 blue PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAK0lEQVR42mNkYGD4z0ABYBw1gGE0DBhGo2EwDIbBYDAYDAaDwWAwGAwAAL0BBAF5n6xMAAAAAElFTkSuQmCC",
  "base64"
);

for (const name of ["icon16.png", "icon48.png", "icon128.png"]) {
  writeFileSync(join(iconsDir, name), png);
}

console.log("icons written to", iconsDir);
