// @ts-check
// The one JavaScript file in the project: svelte-check and @sveltejs/vite-plugin-svelte v4
// only load svelte.config.{js,mjs,cjs}. `@ts-check` plus the JSDoc type below keep it
// type-checked anyway. Convert it to svelte.config.ts once the toolchain accepts one.
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
  preprocess: vitePreprocess(),
}
