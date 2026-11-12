import { sveltekit } from '@sveltejs/kit/vite'
import type { Adapter } from '@sveltejs/kit'
import node from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { datasetVersion } from '@gokan/deploy/dataset-version'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { configuredBasePath } from './src/lib/configuredBasePath.ts'

/**
 * How the word, kanji and grammar point pages are served: `prerendered` (the static deploy, until
 * the function that renders them on request is in production, #209) or `on-request` (the server
 * renders them from the published dataset; only the list pages are prerendered). The build's
 * DICTIONARY_ENTITY_PAGES chooses; anything else fails the build.
 */
const entityPages = process.env.DICTIONARY_ENTITY_PAGES ?? 'prerendered'
if (entityPages !== 'prerendered' && entityPages !== 'on-request') {
  throw new Error(`DICTIONARY_ENTITY_PAGES is "${entityPages}": "prerendered" or "on-request".`)
}

/**
 * The server that renders the entity pages on request (#209 runs it in Lambda): build/. Not
 * precompressed: CloudFront compresses what it serves, and compressing every prerendered page
 * (80k files with their `__data.json`, in a static build) fills Node's 4 GB heap.
 */
const server = node({ out: 'build', precompress: false })

/**
 * Two outputs. The server (adapter-node, build/), and the static site: the prerendered pages and
 * files copied into dist/, beside the assets the asset build put there (vite.assets.config.ts),
 * and nothing else. No page loads SvelteKit's client, so neither its `_app/` output nor the
 * `__data.json` it prerenders beside each page (what client-side navigation would fetch) is
 * deployed.
 */
const dictionary = (dir: string): Adapter => ({
  ...server,
  name: 'gokan-dictionary',
  async adapt(builder) {
    await server.adapt(builder)
    const prerendered = `${builder.config.outDir}/output/prerendered`
    builder.copy(`${prerendered}/pages`, dir)
    builder.copy(`${prerendered}/dependencies`, dir, { filter: basename => basename !== '__data.json' })
  },
})

// SvelteKit renders the pages; its configuration lives here since SvelteKit 3 (there is no
// svelte.config.js). The assets the pages link are built first, by vite.assets.config.ts, into
// dist/, where SvelteKit's pages are written beside them.
export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: dictionary('dist'),
      // The path the site is served under (lib/configuredBasePath.ts: /dictionary on the shared host, '' on its
      // own origin). SvelteKit routes under it, and the server finds its prerendered pages under
      // it, at the paths CloudFront forwards.
      paths: { base: configuredBasePath(process.env.VITE_BASE_PATH) },
      // public/ is the asset build's (the favicon); SvelteKit has no static files of its own.
      files: { assets: 'static' },
      prerender: {
        // Every page is listed by its route's `entries` (src/lib/server/pages.ts), never found by
        // following links, so a page exists exactly when the dataset has its entity.
        crawl: false,
        // `concurrency` stays at its default, 1. The pages read the checkout synchronously, so
        // more only interleaves them in one thread, and at 8 SvelteKit 2.70.3 answered one page
        // in 40k with a 404 that never reached the server hook (kklc/1201-1300, every run).
      },
    }),
  ],
  define: {
    // The dataset version every request for a dataset file carries, as gokan-srs's do.
    __DATASET_VERSION__: JSON.stringify(datasetVersion(fileURLToPath(new URL('.', import.meta.url)))),
    __ENTITY_PAGES__: JSON.stringify(entityPages),
  },
})