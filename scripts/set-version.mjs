// Sets the extension's version in manifest.json, package.json and package-lock.json, and prints it.
// Usage: node scripts/set-version.mjs [version]   (no argument: the next patch version)
// Used by the `release` job of .github/workflows/release.yml, which runs no npm install:
// only git, Node and npm's own `version` command. Checks everything before writing anything.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const manifestText = readFileSync("manifest.json", "utf8");
const current = JSON.parse(manifestText).version;
const parts = (v) => v.split(".").map(Number);

let version = process.argv[2];
if (version === undefined || version === "") {
  const [major, minor, patch] = parts(current);
  version = `${major}.${minor}.${patch + 1}`;
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`version must be major.minor.patch (got "${version}")`);
}
const [next, now] = [parts(version), parts(current)];
const higher = next.reduce((result, n, i) => (result !== 0 ? result : Math.sign(n - now[i])), 0) > 0;
if (!higher) {
  fail(`version ${version} is not higher than the current ${current}`);
}
const tags = execFileSync("git", ["tag", "-l", `v${version}`], { encoding: "utf8" }).trim();
if (tags !== "") {
  fail(`tag v${version} already exists`);
}

// Updates package.json and package-lock.json, keeping their indentation (and repairing a
// package.json that already says `version`).
execFileSync("npm", ["version", version, "--no-git-tag-version", "--ignore-scripts", "--allow-same-version"], {
  stdio: ["ignore", "ignore", "inherit"],
});
// Edit the one line rather than re-serialize, so the file's formatting stays as it is.
writeFileSync("manifest.json", manifestText.replace(`"version": "${current}"`, `"version": "${version}"`));
console.log(version);
