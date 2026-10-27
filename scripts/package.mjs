// Zips dist-store/ (from `npm run build:store`) into release/frunchy-<version>.zip.
// With `firefox`, zips dist-firefox/ (from `npm run build:firefox`) into release/frunchy-<version>-firefox.zip
// and writes the source archive release/frunchy-<version>-source.zip that Mozilla's reviewers rebuild from.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const firefox = process.argv[2] === "firefox";
if (process.argv.length > 2 && !firefox) {
  console.error("usage: node scripts/package.mjs [firefox]");
  process.exit(1);
}

const dist = firefox ? "dist-firefox" : "dist-store";
if (!existsSync(join(dist, "manifest.json"))) {
  console.error(`${dist}/manifest.json not found; run \`npm run ${firefox ? "build:firefox" : "build:store"}\` first`);
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

// The source archive is `git archive HEAD`, so it only matches the package when everything is committed.
if (firefox && execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() !== "") {
  console.error("the working tree has uncommitted changes; commit them first, so the source archive matches the package");
  process.exit(1);
}

mkdirSync("release", { recursive: true });
const zip = join("release", `frunchy-${version}${firefox ? "-firefox" : ""}.zip`);
rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-X", `../${zip}`, "."], { cwd: dist, stdio: "inherit" });
console.log(`${zip} (${Math.round(statSync(zip).size / 1024)} KB)`);

if (firefox) {
  const source = join("release", `frunchy-${version}-source.zip`);
  rmSync(source, { force: true });
  execFileSync("git", ["archive", "--format=zip", "-o", source, "HEAD"], { stdio: "inherit" });
  console.log(`${source} (${Math.round(statSync(source).size / 1024)} KB)`);
}
