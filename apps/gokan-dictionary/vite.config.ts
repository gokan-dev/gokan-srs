import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { deprecations, type Deprecations } from 'sass'

// Every deprecation Sass currently warns about. `Deprecations` has no index signature, so
// `Object.values` would type it as `any[]`; the keys are narrowed instead.
const activeDeprecations = Object.keys(deprecations)
  .filter((id): id is keyof Deprecations => id in deprecations)
  .map(id => deprecations[id])
  .filter(deprecation => deprecation.status === 'active')

// This app has no client-side router, SPA shell or client-side Svelte: the pages are static HTML
// written by scripts/prerender.ts (a standalone Bun script that compiles the page components
// server-side, see its header comment). This build's only job is producing the browser-facing
// assets prerender.ts links into the pages: the stylesheets, and the two plain TypeScript scripts
// (the site-wide search and the grammar index's filter). Each is an explicit input so Vite
// content-hashes and manifests it. With no Svelte plugin here, a .svelte import reaching a
// client script fails the build instead of shipping a Svelte runtime to the browser.
const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  // Relative asset URLs inside the CSS (the web font) and between scripts, so the build works
  // under any BASE_PATH (/dictionary on the shared host, '' on a subdomain).
  base: './',
  css: {
    preprocessorOptions: {
      // A deprecation fails the build instead of warning: a warning scrolls past in CI (slash
      // division did, #134) and becomes an error at Sass's next major release.
      scss: { fatalDeprecations: activeDeprecations },
    },
  },
  build: {
    outDir: 'dist',
    manifest: true,
    rollupOptions: {
      input: {
        // One entry per stylesheet: app.scss is loaded by every page, and each pages/*.scss by
        // exactly the pages that need it. Splitting them means a rule change on one page type
        // does not alter the content hash embedded in every other page's <link>, so it does not
        // re-upload the whole site.
        styles: entry('./src/styles/app.scss'),
        stylesHome: entry('./src/styles/pages/home.scss'),
        stylesVocab: entry('./src/styles/pages/vocab.scss'),
        stylesKanji: entry('./src/styles/pages/kanji.scss'),
        stylesKanjiIndex: entry('./src/styles/pages/kanji-index.scss'),
        stylesGrammar: entry('./src/styles/pages/grammar.scss'),
        stylesGrammarIndex: entry('./src/styles/pages/grammar-index.scss'),
        stylesGrammarChapters: entry('./src/styles/pages/grammar-chapters.scss'),
        stylesGrammarFamily: entry('./src/styles/pages/grammar-family.scss'),
        stylesGrammarConjugations: entry('./src/styles/pages/grammar-conjugations.scss'),
        search: entry('./src/client/search.ts'),
        grammarFilter: entry('./src/client/grammarFilter.ts'),
      },
    },
  },
})
