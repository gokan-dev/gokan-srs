import { sveltekit } from '@sveltejs/kit/vite'
import { datasetVersion } from '@gokan/deploy/dataset-version'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

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

// SvelteKit renders the pages (svelte.config.js). The assets they link are built first, by
// vite.assets.config.ts, into dist/, where SvelteKit's pages are written beside them.
export default defineConfig({
  plugins: [sveltekit()],
  define: {
    // The dataset version every request for a dataset file carries, as gokan-srs's do.
    __DATASET_VERSION__: JSON.stringify(datasetVersion(fileURLToPath(new URL('.', import.meta.url)))),
    __ENTITY_PAGES__: JSON.stringify(entityPages),
  },
})
