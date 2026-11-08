// @ts-check
// The one JavaScript file in the project: svelte-check and SvelteKit only load
// svelte.config.{js,mjs,cjs}. `@ts-check` plus the JSDoc types below keep it type-checked anyway.
// Convert it to svelte.config.ts once the toolchain accepts one.
import node from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

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
 * @param {string} dir
 * @returns {import('@sveltejs/kit').Adapter}
 */
const dictionary = dir => ({
  ...server,
  name: 'gokan-dictionary',
  async adapt(builder) {
    await server.adapt(builder)
    const prerendered = `${builder.config.kit.outDir}/output/prerendered`
    builder.copy(`${prerendered}/pages`, dir)
    builder.copy(`${prerendered}/dependencies`, dir, { filter: basename => basename !== '__data.json' })
  },
})

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: dictionary('dist'),
    // public/ is the asset build's (the favicon); SvelteKit has no static files of its own.
    files: { assets: 'static' },
    prerender: {
      // Every page is listed by its route's `entries` (src/lib/server/pages.ts), never found by
      // following links, so a page exists exactly when the dataset has its entity.
      crawl: false,
      // `concurrency` stays at its default, 1. The pages read the checkout synchronously, so more
      // only interleaves them in one thread, and at 8 SvelteKit 2.70.3 answered one page in 40k
      // with a 404 that never reached the server hook (kklc/1201-1300, every run).
    },
  },
}
