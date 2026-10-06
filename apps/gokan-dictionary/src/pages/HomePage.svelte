<script lang="ts">
  import type { VocabSummary } from '../lib/types';
  import { grammarIndexPath, kanjiIndexPath, vocabIndexPath, vocabJlptPath } from '../lib/urls';
  import { SITE_ORIGIN } from '../lib/site';
  import PageLayout from './PageLayout.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  interface Props {
    vocabCount: number;
    kanjiCount: number;
    grammarCount: number;
    sentenceCount: number;
    /** A handful of common words, as a concrete "this is what a page looks like" entry point. */
    featured: VocabSummary[];
  }

  let { vocabCount, kanjiCount, grammarCount, sentenceCount, featured }: Props = $props();
</script>

<PageLayout>
  <div class="home-hero">
    <h1>Japanese Dictionary</h1>
    <p class="home-lede">
      Look up any Japanese word, kanji, or grammar point. Every entry shows readings, meanings,
      JLPT level, and real example sentences, with every word in those sentences linked to its
      own entry. Free, no account, no ads.
    </p>
    <p class="muted home-stats">
      {vocabCount.toLocaleString()} words &middot; {kanjiCount.toLocaleString()} kanji &middot;
      {grammarCount.toLocaleString()} grammar points &middot; {sentenceCount.toLocaleString()} example sentences
    </p>
  </div>

  <!--
    The home page's job is to route: search is in the header on every page, so repeating a
    large search box here would just duplicate it. What the home page can uniquely offer is the
    three browsable entry points, which is also what gives the kanji and grammar index pages a
    depth-1 link rather than leaving them reachable only from the sitemap.
  -->
  <ul class="browse-grid">
    <li>
      <a class="browse-tile" href={vocabIndexPath()}>
        <span class="browse-tile-title">Vocabulary</span>
        <span class="browse-tile-count">{vocabCount.toLocaleString()} entries</span>
        <span class="browse-tile-blurb">Readings, meanings, and example sentences for every word.</span>
      </a>
    </li>
    <li>
      <a class="browse-tile" href={kanjiIndexPath()}>
        <span class="browse-tile-title">Kanji</span>
        <span class="browse-tile-count">{kanjiCount.toLocaleString()} characters</span>
        <span class="browse-tile-blurb">JLPT level, KKLC step, and the words that use each character.</span>
      </a>
    </li>
    <li>
      <a class="browse-tile" href={grammarIndexPath()}>
        <span class="browse-tile-title">Grammar</span>
        <span class="browse-tile-count">{grammarCount.toLocaleString()} points</span>
        <span class="browse-tile-blurb">Formation patterns, explanations, and worked examples.</span>
      </a>
    </li>
  </ul>

  <section class="card">
    <h2>Browse vocabulary by JLPT level</h2>
    <p class="level-nav">
      {#each [5, 4, 3, 2, 1] as level (level)}
        <a href={vocabJlptPath(level)}>N{level}</a>
      {/each}
    </p>
  </section>

  {#if featured.length > 0}
    <section class="card">
      <h2>Common words</h2>
      <VocabEntryList entries={featured} />
    </section>
  {/if}

  <section class="card">
    <h2>About this dictionary</h2>
    <p>
      Gokan Dictionary is built on the open, CC BY-SA-licensed
      <a href="https://github.com/gokan-dev/gokan-dataset">gokan-dataset</a>, which combines
      JMdict definitions, Tatoeba example sentences, and JLPT and KKLC level data into a single
      cross-linked reference.
    </p>
    <p>
      It is the reference companion to <a href={SITE_ORIGIN + '/'}>Gokan SRS</a>, a free spaced
      repetition app that teaches vocabulary built from the kanji you already know. Use the
      dictionary to look something up; use the app to actually retain it.
    </p>
  </section>
</PageLayout>
