// Zips dist-store/ (from `npm run build:store`) into release/frunchy-<version>.zip.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = "dist-store";
if (!existsSync(join(dist, "manifest.json"))) {
  console.error(`${dist}/manifest.json not found; run \`npm run build:store\` first`);
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));

// The store build must never reach a local address.
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
for (const file of files(dist)) {
  if (readFileSync(file).includes("localhost")) {
    console.error(`${dist} contains "localhost" in ${file}; the store build must not reach local addresses`);
    process.exit(1);
  }
}

mkdirSync("release", { recursive: true });
const zip = join("release", `frunchy-${version}.zip`);
rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-X", `../${zip}`, "."], { cwd: dist, stdio: "inherit" });
console.log(`${zip} (${Math.round(statSync(zip).size / 1024)} KB)`);
