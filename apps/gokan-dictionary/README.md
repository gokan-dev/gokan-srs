# gokan-dictionary

The static dictionary, live at [gokan-srs.com/dictionary](https://gokan-srs.com/dictionary/). For the project overview, see the [repository README](../../README.md).

A free Japanese dictionary for people who just want to look something up, without going through the SRS setup flow. About 35,900 words, 2,300 kanji and 766 grammar points, each with its own page, and a search that understands kana, kanji, romaji, English and conjugated forms.

## How it works

A SvelteKit app whose every page is prerendered into a plain static `index.html`, served by any static host. Pages render on the server only (`csr = false`): no page loads a Svelte runtime or SvelteKit's client, and there is no client-side router.

The build has two steps. `vite.assets.config.ts` builds the browser-facing assets the pages link (the stylesheets, the one web font and two plain TypeScript scripts) into `dist/`; then SvelteKit renders every page beside them. Each route's `load` gets its page's props and document shell from `src/lib/server/pages.ts`, which reads the dataset through one `DictionaryData`; `src/hooks.server.ts` wraps the rendered body in the shell (`lib/documentShell.ts`) and refuses Japanese text not marked `lang="ja"`.

A full build writes about 40,350 files, then checks itself (`scripts/check-build.ts`: size budgets, no Svelte runtime, search acceptance queries against the real index), and is byte-for-byte reproducible: rebuilding without a source or dataset change produces identical output, which is what lets the deploy upload only what actually differs.

## Structure

```
src/
  routes/     One SvelteKit route per page type, each a load and its page component;
              the search index, sitemap.xml and robots.txt as endpoints.
  pages/      Svelte components, server-rendered: one per page type, plus shared pieces.
  lib/        Pure, tested helpers: search index and query, conjugation, senses, furigana,
              URLs, SEO metadata, the document shell, size budgets.
  lib/server/ Every page's props and shell, and the catalog of pages (pages.ts); the
              asset hrefs (assets.ts).
  hooks.server.ts  Wraps each page's body in its document shell.
  client/     The only browser code, plain TypeScript: search (and the furigana toggle),
              and the grammar index's filter.
  styles/     SCSS. app.scss for shared rules, pages/*.scss for one page type each.
  fonts/      Source Serif 4, 600, Latin subset: the one web font.
scripts/
  check-build.ts        Budgets and search acceptance checks, run after the build.
  check-parity.ts       Compares this build with another, file by file (bun run check:parity).
```

Two conventions worth knowing before editing:

**Stylesheets are split per page type.** Only rules used by two or more page types belong in `app.scss`. This is not just tidiness: the stylesheet's content hash is embedded in every page's `<link>`, so a rule added to `app.scss` changes all 40,000 pages and re-uploads the entire site, while a rule in `pages/vocab.scss` re-uploads only the vocabulary pages.

**Everything is typed.** No JavaScript files, no implicit `any`. `bun run typecheck` (part of `bun run check`) covers `.svelte` files as well as `.ts` and must report zero errors and zero warnings.

## Running locally

```bash
bun install
bun run --cwd apps/gokan-dictionary build      # assets, then every page into dist/, check budgets
bun run --cwd apps/gokan-dictionary preview    # serve dist/ locally
bun run --cwd apps/gokan-dictionary test       # vitest
bun run --cwd apps/gokan-dictionary typecheck  # svelte-check
```

`bun run --cwd apps/gokan-dictionary dev` builds the site and serves it (`build`, then `preview`): there is no dev-server shell, since every page is prerendered.

The build reads the compiled dataset from the [gokan-dataset](https://github.com/gokan-dev/gokan-dataset) submodule at `apps/gokan-srs/dataset/`, and will initialize it automatically if it has not been checked out.

## Deployment

The site is served from the `/dictionary` prefix of the main app's origin rather than its own subdomain, so both share one hostname's ranking signals. `VITE_BASE_PATH` controls that prefix; setting it to an empty string builds for a bare origin instead, which is the only source change a move to a subdomain would need.

Uploads go through the shared `packages/deploy/scripts/deploy-s3.ts` (the main app uses it too), which hashes every built file, compares against a manifest stored alongside the site, and sends only what changed. A dataset change touching 200 entries uploads 200 pages rather than 40,000.

Rules are in [AGENTS.md](../../AGENTS.md), architecture notes in [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#gokan-dictionary-app).
