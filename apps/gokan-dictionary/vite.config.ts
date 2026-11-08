import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

// SvelteKit renders the pages (svelte.config.js). The assets they link are built first, by
// vite.assets.config.ts, into dist/, where SvelteKit's pages are written beside them.
export default defineConfig({
  plugins: [sveltekit()],
})
