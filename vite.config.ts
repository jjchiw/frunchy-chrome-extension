import { crx } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import devManifest from "./manifest.json" with { type: "json" };

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// The backend the store build is fixed to: https only, and only the origin is kept.
const storeBackendOrigin = () => {
    const value = process.env.FRUNCHY_BACKEND_URL;
    if (!value) {
        throw new Error(
            "FRUNCHY_BACKEND_URL is required for the store build, e.g. FRUNCHY_BACKEND_URL=https://frunchy.example npm run package",
        );
    }
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`FRUNCHY_BACKEND_URL must be an https:// URL (got "${value}")`);
    }
    if (url.protocol !== "https:") {
        throw new Error(`FRUNCHY_BACKEND_URL must be an https:// URL (got "${value}")`);
    }
    return url.origin;
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // `vite build --mode store` makes the Chrome Web Store build: one fixed backend, no localhost.
    const store = mode === "store";
    const origin = store ? storeBackendOrigin() : "";

    // manifest.json stays the development manifest; the store build narrows its host permissions.
    const manifest = structuredClone(devManifest) as typeof devManifest & { optional_host_permissions?: string[] };
    if (store) {
        manifest.host_permissions = ["https://www.crunchyroll.com/*", `${origin}/*`];
        delete manifest.optional_host_permissions;
    }

    return {
        plugins: [svelte(), crx({ manifest })],
        resolve: {
            alias: {
                src: srcDir,
            },
        },
        define: {
            __STORE_BUILD__: JSON.stringify(store),
            __BACKEND_URL__: JSON.stringify(store ? origin : "http://localhost:5099"),
        },
        build: {
            outDir: store ? "dist-store" : "dist",
        },
    };
});
