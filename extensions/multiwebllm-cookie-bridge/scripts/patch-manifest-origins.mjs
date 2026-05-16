import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "..", "manifest.json");

const origins = process.argv.slice(2).filter(Boolean);
if (origins.length === 0) {
  console.error(
    "Usage: node scripts/patch-manifest-origins.mjs https://your-dashboard.example.com"
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function toMatchPattern(origin) {
  const u = new URL(origin);
  const host = u.hostname;
  const port = u.port ? `:${u.port}` : "";
  return `${u.protocol}//${host}${port}/*`;
}

const patterns = new Set([
  ...(manifest.externally_connectable?.matches ?? []),
  ...(manifest.content_scripts?.[0]?.matches ?? []),
]);

for (const origin of origins) {
  patterns.add(toMatchPattern(origin));
}

manifest.externally_connectable = { matches: [...patterns] };
if (manifest.content_scripts?.[0]) {
  manifest.content_scripts[0].matches = [...patterns];
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("Updated manifest patterns:", [...patterns]);
