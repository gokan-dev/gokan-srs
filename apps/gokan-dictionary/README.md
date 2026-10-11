# gokan-dictionary

The static dictionary, live at [gokan-srs.com/dictionary](https://gokan-srs.com/dictionary/). For the project overview, see the [repository README](../../README.md).

A free Japanese dictionary for people who just want to look something up, without going through the SRS setup flow. About 35,900 words, 2,300 kanji and 766 grammar points, each with its own page, and a search that understands kana, kanji, romaji, English and conjugated forms.

## How it works

Every page is a plain static `index.html`, generated once at build time by `scripts/prerender.ts` and served by any static host with no server runtime. There is no client-side router and no SSR framework.

Svelte components are compiled in server mode through a small Bun runtime plugin (`scripts/svelte-ssr-loader.ts`), independent of the Vite build. Vite's only production job is building the browser-facing assets those pages link: the stylesheets, the one web font and two plain TypeScript scripts. No page loads a Svelte runtime.

A full build writes about 39,250 files in under 20 seconds, then checks itself (`scripts/check-build.ts`: size budgets, no Svelte runtime, search acceptance queries against the real index), and is byte-for-byte reproducible: rebuilding without a source or dataset change produces identical output, which is what lets the deploy upload only what actually differs.

## Structure

```
src/
  pages/      Svelte components, server-rendered: one per page type, plus shared pieces.
  lib/        Pure, tested helpers: search index and query, conjugation, senses, furigana,
              URLs, SEO metadata, the document shell, size budgets.
  client/     The only browser code, plain TypeScript: search (and the furigana toggle),
              and the grammar index's filter.
  styles/     SCSS. app.scss for shared rules, pages/*.scss for one page type each.
  fonts/      Source Serif 4, 600, Latin subset: the one web font.
scripts/
  prerender.ts          The generator.
  check-build.ts        Budgets and search acceptance checks, run after it.
  svelte-ssr-loader.ts  Compiles .svelte server-side for the generator.
```

Two conventions worth knowing before editing:

**Stylesheets are split per page type.** Only rules used by two or more page types belong in `app.scss`. This is not just tidiness: the stylesheet's content hash is embedded in every page's `<link>`, so a rule added to `app.scss` changes all 39,000 pages and re-uploads the entire site, while a rule in `pages/vocab.scss` re-uploads only the vocabulary pages.

**Everything is typed.** No JavaScript files, no implicit `any`. `bun run typecheck` (part of `bun run check`) covers `.svelte` files as well as `.ts` and must report zero errors and zero warnings.

## Running locally

```bash
bun install
bun run --cwd apps/gokan-dictionary build      # vite build, prerender into dist/, check budgets
bun run --cwd apps/gokan-dictionary preview    # serve dist/ locally
bun run --cwd apps/gokan-dictionary test       # vitest
bun run --cwd apps/gokan-dictionary typecheck  # svelte-check
```

`bun run --cwd apps/gokan-dictionary dev` builds the site and serves it (`build`, then `preview`): there is no dev-server shell, since every page is generated.

The build reads the compiled dataset from the [gokan-dataset](https://github.com/gokan-dev/gokan-dataset) submodule at `apps/gokan-srs/dataset/`, and will initialize it automatically if it has not been checked out.

## Deployment

The site is served from the `/dictionary` prefix of the main app's origin rather than its own subdomain, so both share one hostname's ranking signals. `VITE_BASE_PATH` controls that prefix; setting it to an empty string builds for a bare origin instead, which is the only source change a move to a subdomain would need.

Uploads go through the shared `packages/deploy/scripts/deploy-s3.ts` (the main app uses it too), which hashes every built file, compares against a manifest stored alongside the site, and sends only what changed. A dataset change touching 200 entries uploads 200 pages rather than 39,000.

Rules are in [AGENTS.md](../../AGENTS.md), architecture notes in [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#gokan-dictionary-app).
