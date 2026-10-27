import { crx, type ManifestV3Export } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import devManifest from "./manifest.json" with { type: "json" };

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// CRXJS's manifest type, with the Firefox background (`scripts`, and the `type` Firefox reads) and
// the Android gecko settings that its type leaves out.
type CrxManifest = Extract<ManifestV3Export, { manifest_version: number }>;
type Manifest = Omit<CrxManifest, "background" | "browser_specific_settings"> & {
    background: { service_worker: string; type?: string } | { scripts: string[]; type?: string };
    browser_specific_settings?: NonNullable<CrxManifest["browser_specific_settings"]> & {
        gecko_android?: { strict_min_version: string };
    };
};

// The default backend of the store and Firefox builds: https only, and only the origin is kept.
const storeBackendOrigin = () => {
    const value = process.env.FRUNCHY_BACKEND_URL;
    if (!value) {
        throw new Error(
            "FRUNCHY_BACKEND_URL is required for the store and Firefox builds, e.g. FRUNCHY_BACKEND_URL=https://frunchy.example npm run package",
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
    // `vite build --mode store` makes the Chrome Web Store build: a default backend instead of localhost.
    const store = mode === "store";
    // `--mode firefox` makes the Firefox add-on: the store build's hosts, with Firefox's manifest keys.
    const firefox = mode === "firefox";
    const origin = store || firefox ? storeBackendOrigin() : "";

    // manifest.json stays the development manifest. The store and Firefox builds ask at install only for
    // Crunchyroll and their default backend; any other https server (self-hosted) is requested when the
    // user saves it.
    const manifest = structuredClone(devManifest) as unknown as Manifest;
    if (store || firefox) {
        manifest.host_permissions = ["https://www.crunchyroll.com/*", `${origin}/*`];
        manifest.optional_host_permissions = ["https://*/*"];
    }
    if (firefox) {
        // Firefox runs the background as a page with scripts, not a service worker. The data collection
        // keys mirror the Chrome privacy answers.
        manifest.background = { scripts: [devManifest.background.service_worker], type: "module" };
        delete manifest.minimum_chrome_version;
        manifest.browser_specific_settings = {
            gecko: {
                id: "frunchy@lacalabaza.xyz",
                strict_min_version: "140.0",
                data_collection_permissions: {
                    required: ["websiteContent", "personallyIdentifyingInfo", "authenticationInfo"],
                },
            },
            gecko_android: { strict_min_version: "142.0" },
        };
    }

    return {
        plugins: [svelte(), crx(firefox ? { manifest, browser: "firefox" } : { manifest })],
        resolve: {
            alias: {
                src: srcDir,
            },
        },
        define: {
            __BACKEND_URL__: JSON.stringify(store || firefox ? origin : "http://localhost:5099"),
        },
        build: {
            outDir: store ? "dist-store" : firefox ? "dist-firefox" : "dist",
        },
    };
});
