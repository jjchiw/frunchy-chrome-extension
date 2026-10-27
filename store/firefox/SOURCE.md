# Building Frunchy from source (for Mozilla's reviewers)

This archive is `git archive` of the commit the submitted package was built from. The build is
deterministic: the files in `dist-firefox/` are the files in the submitted package, apart from zip
timestamps.

## Requirements

- Any OS. The submitted package was built on ubuntu-latest in GitHub Actions.
- Node 22.x (22.12 or later) and npm 10 or later.

## Steps

```bash
npm ci
FRUNCHY_BACKEND_URL=https://frunchy.lacalabaza.xyz npm run build:firefox
```

The output is `dist-firefox/`, identical to the contents of the submitted package. The build fails
without `FRUNCHY_BACKEND_URL`, which must be an `https://` address. The value above is the
extension's default server.

## What is bundled

- The extension's own code: Svelte 5 components and TypeScript in `src/`, compiled with Vite 8 and
  `@sveltejs/vite-plugin-svelte`, with `@crxjs/vite-plugin` writing the manifest and the content-script
  loader. `manifest.json` lists the entry points; `vite.config.ts` derives the Firefox manifest from
  it (`--mode firefox`).
- Fonts from the `@fontsource` packages (Figtree, Bricolage Grotesque, IBM Plex Mono), bundled as
  files. Nothing is loaded from a remote server.
- Material Symbols icons, from `@material-symbols/svg-400`, imported as SVG text into
  `src/components/Icon.svelte`.
- `public/injected.js` is plain JavaScript and is copied to `dist-firefox/` unminified.

All dependencies are pinned in `package.json` and `package-lock.json`.
