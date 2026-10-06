import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import checker from 'vite-plugin-checker';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const isCI = process.env.NODE_ENV === 'production';

// The dataset submodule's pinned commit, appended to every dataset request (datasetUrl in
// src/services/http.ts) so browsers never serve a file cached from an older dataset. Read from
// this repo's tree rather than the submodule, so it works before the submodule is checked out.
const datasetVersion = execFileSync('git', ['rev-parse', '--short=12', 'HEAD:./dataset'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    encoding: 'utf8',
}).trim();

export default defineConfig({
    define: {
        __DATASET_VERSION__: JSON.stringify(datasetVersion),
    },
    plugins: [
        react(),
        tailwindcss(),
        !isCI && checker({
            typescript: {
                buildMode: true,
                tsconfigPath: "./tsconfig.app.json",
            },
        }),
    ].filter(Boolean),
    server: {
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