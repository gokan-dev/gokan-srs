import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'

// This app has no client-side router or SPA shell in production - `index.html`/App.svelte
// exist only for local `vite dev` iteration. The real pages are static HTML files written by
// scripts/prerender.ts (a standalone Bun script, not part of this Vite build - it compiles
// the page components server-side via svelte/compiler directly, see its header comment for
// why). This build's only production-relevant job is producing the two browser-facing assets
// prerender.ts links into every static page: the global stylesheet and the search script -
// both listed as extra rollup inputs so Vite content-hashes and manifests them like any other
// entry, instead of relying on them being pulled in transitively from index.html (which isn't
// used in the static output at all). The grammar browser is a third entry: unlike the other
// two it pulls a Svelte component into the CLIENT build (the only component that is compiled
// for the browser rather than server-rendered), which is why it goes through Vite's svelte
// plugin here instead of the prerender script's server-mode loader.
export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    manifest: true,
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        // One entry per stylesheet: app.scss is loaded by every page, and each pages/*.scss by
        // exactly the page that needs it. Splitting them means a rule change on one page type
        // does not alter the content hash embedded in every other page's <link>, so it does not
        // re-upload the whole site (see CLAUDE.md's Deployment section).
        styles: fileURLToPath(new URL('./src/styles/app.scss', import.meta.url)),
        stylesHome: fileURLToPath(new URL('./src/styles/pages/home.scss', import.meta.url)),
        stylesVocab: fileURLToPath(new URL('./src/styles/pages/vocab.scss', import.meta.url)),
        stylesKanji: fileURLToPath(new URL('./src/styles/pages/kanji.scss', import.meta.url)),
        stylesKanjiIndex: fileURLToPath(new URL('./src/styles/pages/kanji-index.scss', import.meta.url)),
        stylesGrammar: fileURLToPath(new URL('./src/styles/pages/grammar.scss', import.meta.url)),
        stylesGrammarIndex: fileURLToPath(new URL('./src/styles/pages/grammar-index.scss', import.meta.url)),
        stylesGrammarChapters: fileURLToPath(new URL('./src/styles/pages/grammar-chapters.scss', import.meta.url)),
        stylesGrammarFamily: fileURLToPath(new URL('./src/styles/pages/grammar-family.scss', import.meta.url)),
        stylesGrammarConjugations: fileURLToPath(new URL('./src/styles/pages/grammar-conjugations.scss', import.meta.url)),
        search: fileURLToPath(new URL('./src/client/search.ts', import.meta.url)),
        grammarBrowser: fileURLToPath(new URL('./src/client/grammarBrowser.ts', import.meta.url)),
      },
    },
  },
})
