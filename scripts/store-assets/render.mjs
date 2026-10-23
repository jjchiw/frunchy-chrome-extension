// Renders the Chrome Web Store images into store/images/ and the website guide's plain 2x
// shots into store/guide/ from invented fixtures:
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
const guideOut = join(root, "store", "guide");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

execFileSync(process.execPath, [join(root, "node_modules", "vite", "bin", "vite.js"), "build", "--config", join(here, "vite.config.mjs"), "--logLevel", "error"], {
  cwd: root,
  stdio: "inherit",
});
mkdirSync(out, { recursive: true });
mkdirSync(guideOut, { recursive: true });

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
// The guide's shots have no canvas: the component alone at 2x, at its natural height, which a
// first pass reads from the page before the second one sizes the window.
const guideImages = ["en", "es"].flatMap((lang) =>
  states.map((state) => ({
    file: `extension-${state}-${lang}.png`,
    query: `kind=plain&state=${state}&lang=${lang}`,
    width: state === "options" ? 480 : 380,
    scale: 2,
    minBytes: 20_000,
    dir: guideOut,
  })),
);

const ATTEMPTS = 8;
const chromeArgs = (scale) => ["--headless=new", "--disable-gpu", "--allow-file-access-from-files", "--hide-scrollbars", `--force-device-scale-factor=${scale}`];

// The natural height of a plain shot, from the page's data-height. A dump taken before the page
// has laid out lacks it (more than half of them), so it is retried more than a screenshot.
const HEIGHT_ATTEMPTS = 30;
function naturalHeight(url) {
  for (let attempt = 1; attempt <= HEIGHT_ATTEMPTS; attempt++) {
    try {
      const dom = execFileSync(chrome, [...chromeArgs(1), "--virtual-time-budget=30000", "--run-all-compositor-stages-before-draw", "--dump-dom", url], {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      });
      const height = Number(/data-height="(\d+)"/.exec(dom)?.[1]);
      if (height > 0 && dom.includes('data-ready="true"')) return height;
    } catch {
      // Retry.
    }
  }
  console.error(`${url}: no height after ${HEIGHT_ATTEMPTS} attempts`);
  process.exit(1);
}

for (const { file, query, width, height: fixedHeight, scale = 1, minBytes, dir = out } of [...images, ...guideImages]) {
  const png = join(dir, file);
  rmSync(png, { force: true });
  const url = `file://${join(here, "dist", "index.html")}?${query}`;
  const height = fixedHeight ?? naturalHeight(url);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      execFileSync(
        chrome,
        [
          ...chromeArgs(scale),
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
