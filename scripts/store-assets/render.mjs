// Renders the Chrome Web Store images into store/images/ from invented fixtures:
//   node scripts/store-assets/render.mjs        (or `npm run store:assets`)
// It builds the generator page, then screenshots it with headless Chrome (CHROME overrides
// the macOS default path). The page is hidden until it has laid out, so a screenshot taken
// too early is a plain background: a small PNG, which is retried.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const here = join(root, "scripts", "store-assets");
const out = join(root, "store", "images");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

execFileSync(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "build", "--config", join(here, "vite.config.mjs"), "--logLevel", "error"], {
  cwd: root,
  stdio: "inherit",
});
mkdirSync(out, { recursive: true });

const states = ["ready", "scraping", "synced", "options"];
const images = [
  ...["en", "es"].flatMap((lang) =>
    states.map((state, i) => ({
      file: `screenshot-${lang}-${i + 1}.png`,
      query: `kind=shot&state=${state}&lang=${lang}`,
      width: 1280,
      height: 800,
      minBytes: 30_000,
    })),
  ),
  { file: "promo-440x280.png", query: "kind=promo&lang=en", width: 440, height: 280, minBytes: 4_000 },
];

const ATTEMPTS = 8;
for (const { file, query, width, height, minBytes } of images) {
  const png = join(out, file);
  rmSync(png, { force: true });
  const url = `file://${join(here, "dist", "index.html")}?${query}`;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      execFileSync(
        chrome,
        [
          "--headless=new",
          "--disable-gpu",
          "--allow-file-access-from-files",
          "--hide-scrollbars",
          "--force-device-scale-factor=1",
          `--window-size=${width},${height}`,
          "--virtual-time-budget=30000",
          "--run-all-compositor-stages-before-draw",
          `--screenshot=${png}`,
          url,
        ],
        { stdio: "ignore" },
      );
    } catch {
      // Chrome can exit non-zero after writing the screenshot; the size check decides.
    }
    if (existsSync(png) && statSync(png).size >= minBytes) break;
    if (attempt === ATTEMPTS) {
      console.error(`${file}: still blank after ${ATTEMPTS} attempts`);
      process.exit(1);
    }
  }
  console.log(`${file} (${Math.round(statSync(png).size / 1024)} KB)`);
}
