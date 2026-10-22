// Builds the store-asset generator page (see render.mjs). It mounts the real Popup and
// Settings components with the store build's constants, so it needs the repository's
// `src` alias and Svelte, and nothing else from the extension build.
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
    root: here,
    base: "./",
    plugins: [svelte()],
    resolve: {
        alias: {
            src: `${repo}src`,
            "@repo": repo,
        },
    },
    define: {
        __BACKEND_URL__: JSON.stringify(process.env.FRUNCHY_BACKEND_URL ?? "https://frunchy.example"),
    },
    build: {
        outDir: `${here}dist`,
        emptyOutDir: true,
        target: "esnext",
        assetsInlineLimit: 0,
    },
});
