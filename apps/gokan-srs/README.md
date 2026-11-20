# gokan-srs

The SRS study app, live at [gokan-srs.com](https://gokan-srs.com). For the project overview and screenshots, see the [repository README](../../README.md); this file covers the app itself.

A Japanese vocabulary learning app built around a custom spaced repetition system. Words unlock based on which kanji you actually know, so you are never tested on a word you could not possibly read.

## What it does

**Kanji-aware progression.** The app maps your KKLC study progress to the vocabulary it unlocks. If you haven't studied a kanji yet, words containing it stay hidden.

**Two-phase SRS.** Each word is tested separately for reading (type the hiragana) and meaning (recall the English gloss from a real sentence). Reviews are staggered so the two phases don't bleed into each other.

**Adaptive scheduling.** The SRS algorithm is custom, grounded in research on spaced repetition effects in second-language acquisition (Kim, 2022). It tracks per-word difficulty and response latency: a slow correct answer schedules a shorter interval than a fast one. The algorithm converges on a 75% recall target, which the literature identifies as the optimal point for long-term retention without over-reviewing.

**Sentence context.** A batch data pipeline links each word to real Japanese sentences. Meaning quizzes present the word in context, not in isolation. When your answer doesn't match any dictionary gloss, a Gemini Flash call determines whether it's semantically correct in context, handling paraphrases gracefully.

**No backend.** Progress syncs to a private Google Drive file via OAuth. The SRS engine runs entirely in the browser.

**Mobile-first, accessible.** The app is designed to be used on a phone during a commute as naturally as at a desk. Layouts are fully responsive, touch targets are deliberately sized, and keyboard navigation is a first-class concern throughout the quiz flow.

## Stack

| Layer | Technology |
|---|---|
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Animations | Framer Motion |
| Build | Vite (rolldown-vite) + Bun |
| Testing | Vitest |
| Auth | Google OAuth |
| Hosting | AWS S3 + CloudFront |
| CI/CD | GitHub Actions |

## Data pipeline

The vocabulary dataset is pre-compiled from raw sources at build time, not fetched at runtime. The pipeline processes JMDict (the standard Japanese dictionary), cross-references JPDB frequency data, merges homograph entries, and uses a morphological analyzer (Kuromoji, a port of MeCab) to tokenize 230,000 real sentences and link each to the relevant vocabulary. The resulting ~37,000 word files and ~32,000 sentence files are served as static JSON from S3.

This keeps the client lean, latency-free on reviews, and the hosting bill near zero.

## Infrastructure

GitHub Actions runs tests before deploying. On success, Vite builds the SPA, the artifact is synced to S3 with split cache-control policies (hashed assets get `immutable`, HTML gets `must-revalidate`), and a CloudFront invalidation ensures users on mobile don't hold stale data.

## Running locally

From the repo root (this app is a workspace member):

```bash
bun install
bun run dev
```

The dataset is not built here. The `gokan-dataset` repo's own CI builds it on every push and commits `compiled/` back to the branch; this app reads the committed `compiled/` in the `dataset` submodule, and a pointer bump points at that bot commit (see [Dataset Consumption](../../docs/ARCHITECTURE.md#dataset-consumption)).

`build:data`, `build:kanji`, `build:jlpt` and `build:jpdb` remain only for debugging one stage from the monorepo. They need the submodule's own one-time `bun install` first (it's outside the root workspace glob, so the root `bun install` doesn't cover it):

```bash
bun install --cwd apps/gokan-srs/dataset
bun run --cwd apps/gokan-srs build:kanji
```

Tests:

```bash
bun run test
```
