import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import checker from 'vite-plugin-checker';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { analyticsScriptTag } from '@gokan/analytics';
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
            ignored: ['**/public/data/compiled', '**/public/data/compiled/**'],
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