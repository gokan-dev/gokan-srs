import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import checker from 'vite-plugin-checker';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect, Plugin } from 'vite';
import { analyticsScriptTag } from '@gokan/analytics';
import { publishedDatasetFile } from '@gokan/deploy/published-dataset';
import { CHANGELOG } from './release/changelog';
import { changelogProblems } from './src/utils/changelog.utils';
import type { LiveVersion } from './src/models/release.model';

const isCI = process.env.NODE_ENV === 'production';

// The dataset submodule's pinned commit, appended to every dataset request (datasetUrl in
// src/services/http.ts) so browsers never serve a file cached from an older dataset. Read from
// this repo's tree rather than the submodule, so it works before the submodule is checked out.
const datasetVersion = execFileSync('git', ['rev-parse', '--short=12', 'HEAD:./dataset'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    encoding: 'utf8',
}).trim();

// The dataset as it is published (core files plus text/en/), read by the app from /dataset/. In
// production the data deploy owns that prefix (docs/ARCHITECTURE.md, Dataset Consumption); the
// build never copies it into dist/. The dev and preview servers answer it from the submodule
// checkout, only the files the deploy publishes, so a missing one is a 404 here as it is absent
// there.
const compiledDir = fileURLToPath(new URL('./dataset/compiled/', import.meta.url));
if (!existsSync(compiledDir)) {
    throw new Error(`The gokan-dataset submodule is not checked out at ${compiledDir}. Run: git submodule update --init --recursive`);
}
const serveDataset: Connect.NextHandleFunction = (request, response, next) => {
    const file = publishedDatasetFile(decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname));
    if (file === null) return next();
    const full = join(compiledDir, file);
    if (!existsSync(full) || !statSync(full).isFile()) {
        response.statusCode = 404;
        response.end();
        return;
    }
    response.setHeader('Content-Type', 'application/json');
    createReadStream(full).pipe(response);
};
const datasetPlugin: Plugin = {
    name: 'gokan-dataset',
    configureServer: server => { server.middlewares.use(serveDataset); },
    configurePreviewServer: server => { server.middlewares.use(serveDataset); },
};

// index/audio.json names the voice clips are read in, and the dataset writes it only once a clip
// is attached (#164). Known here so the app asks for it only when it is there: a missing dataset
// file answers with the SPA shell, not a 404.
const audioIndexShipped = existsSync(fileURLToPath(new URL('./dataset/compiled/index/audio.json', import.meta.url)));

// The app's version is the newest changelog entry's (release/changelog.ts), so every build of a
// tree, a shallow tagless CI checkout included, carries the same one. A list out of order would
// ship the wrong version, so the build refuses it.
const changelogErrors = changelogProblems(CHANGELOG);
if (changelogErrors.length) throw new Error(`release/changelog.ts: ${changelogErrors.join('; ')}`);
const appVersion = CHANGELOG[0].version;

// Unhashed files at the site root, outside the bundle: an open tab polls version.json to learn a
// newer build is live (useUpdateAvailable), and What's new reads changelog.json. Served by the
// dev server too, so both work under `vite`.
const releaseFiles: Record<string, string> = {
    'version.json': JSON.stringify({ version: appVersion, dataset: datasetVersion } satisfies LiveVersion),
    'changelog.json': JSON.stringify(CHANGELOG),
};
const releasePlugin: Plugin = {
    name: 'gokan-release',
    configureServer(server) {
        server.middlewares.use((request, response, next) => {
            const file = request.url?.split('?')[0].slice(1) ?? '';
            if (!Object.hasOwn(releaseFiles, file)) return next();
            response.setHeader('Content-Type', 'application/json');
            response.end(releaseFiles[file]);
        });
    },
    generateBundle() {
        for (const [fileName, source] of Object.entries(releaseFiles)) this.emitFile({ type: 'asset', fileName, source });
    },
};

// Empty outside the production deploy, which is the only build that sets the website id.
const analyticsTag = analyticsScriptTag(process.env.VITE_UMAMI_WEBSITE_ID);

export default defineConfig({
    define: {
        __DATASET_VERSION__: JSON.stringify(datasetVersion),
        __APP_VERSION__: JSON.stringify(appVersion),
        __AUDIO_INDEX_SHIPPED__: JSON.stringify(audioIndexShipped),
    },
    plugins: [
        react(),
        tailwindcss(),
        releasePlugin,
        datasetPlugin,
        {
            name: 'gokan-analytics',
            transformIndexHtml: (html: string) => html.replace('</head>', `${analyticsTag}</head>`),
        },
        !isCI && checker({
            typescript: {
                buildMode: true,
                tsconfigPath: "./tsconfig.app.json",
            },
        }),
    ].filter(Boolean),
    server: {
        // Clips are not in the dataset checkout (Git LFS pointers only), so dev plays staging's,
        // the bucket staging and production share (docs/ARCHITECTURE.md, Audio).
        proxy: {
            '/audio/': { target: 'https://staging.gokan-srs.com', changeOrigin: true },
        },
        watch: {
            ignored: ['**/dataset/compiled/**'],
        }
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'terser',
    },
    test: {
        // The gokan-dataset submodule has its own test suite and CI - vitest's
        // default include glob would otherwise pick up dataset/scripts/*.test.ts too.
        exclude: [...configDefaults.exclude, 'dataset/**'],
    },
})