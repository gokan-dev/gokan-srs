// @ts-check
// The one JavaScript file in the project: svelte-check and SvelteKit only load
// svelte.config.{js,mjs,cjs}. `@ts-check` plus the JSDoc types below keep it type-checked anyway.
// Convert it to svelte.config.ts once the toolchain accepts one.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/**
 * Writes the prerendered pages and files into dist/, beside the assets the asset build put there
 * (vite.assets.config.ts), and nothing else. No page loads SvelteKit's client, so neither its
 * `_app/` output nor the `__data.json` it prerenders beside each page (what client-side
 * navigation would fetch) is ever read: neither is written.
 * @param {string} dir
 * @returns {import('@sveltejs/kit').Adapter}
 */
const prerenderedOnly = dir => ({
  name: 'prerendered-only',
  adapt(builder) {
    const prerendered = `${builder.config.kit.outDir}/output/prerendered`
    builder.copy(`${prerendered}/pages`, dir)
    builder.copy(`${prerendered}/dependencies`, dir, { filter: basename => basename !== '__data.json' })
  },
})

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: prerenderedOnly('dist'),
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
