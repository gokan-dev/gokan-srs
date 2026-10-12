<script lang="ts">
  import type { VocabSummary } from '../lib/types';
  import { grammarIndexPath, kanjiIndexPath, vocabIndexPath } from '../lib/urls';
  import { SITE_ORIGIN } from '../lib/site';
  import PageLayout from './PageLayout.svelte';
  import SearchBox from './SearchBox.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  interface Props {
    vocabCount: number;
    kanjiCount: number;
    grammarCount: number;
    sentenceCount: number;
    /** The most frequent N5 words, as a concrete entry point. */
    featured: VocabSummary[];
  }

  let { vocabCount, kanjiCount, grammarCount, sentenceCount, featured }: Props = $props();
</script>

<!-- The hero is the search field, so the header leaves its own out: one search field on screen. -->
<PageLayout headerSearch={false}>
  <div class="home-hero">
    <h1>Japanese dictionary</h1>
    <p class="home-lede">Look up a word, a kanji or a grammar point, with readings, meanings and example sentences.</p>
    <SearchBox hero />
  </div>

  <section class="section">
    <h2>Browse</h2>
    <ul class="tiles">
      <li>
        <a class="tile" href={vocabIndexPath()}>
          <span class="tile-title">Vocabulary</span>
          <span class="tile-meta">By JLPT level</span>
          <span class="tile-blurb">Readings, meanings, forms and example sentences.</span>
        </a>
      </li>
      <li>
        <a class="tile" href={kanjiIndexPath()}>
          <span class="tile-title">Kanji</span>
          <span class="tile-meta">{kanjiCount.toLocaleString('en')} characters</span>
          <span class="tile-blurb">The words that use each character.</span>
        </a>
      </li>
      <li>
        <a class="tile" href={grammarIndexPath()}>
          <span class="tile-title">Grammar</span>
          <span class="tile-meta">{grammarCount.toLocaleString('en')} points</span>
          <span class="tile-blurb">Patterns, explanations and worked examples.</span>
        </a>
      </li>
    </ul>
  </section>

  {#if featured.length > 0}
    <section class="section">
      <h2>Common words</h2>
      <VocabEntryList entries={featured} />
    </section>
  {/if}

  <p class="meta home-counts">
    {vocabCount.toLocaleString('en')} words · {kanjiCount.toLocaleString('en')} kanji ·
    {grammarCount.toLocaleString('en')} grammar points · {sentenceCount.toLocaleString('en')} example sentences
  </p>

  <section class="section">
    <h2>About</h2>
    <p>
      Built on the open, CC BY-SA-licensed <a href="https://github.com/gokan-dev/gokan-dataset">gokan-dataset</a>:
      JMdict definitions, Tatoeba sentences and JLPT levels. To remember what you look up, learn it
      with spaced repetition in <a href={SITE_ORIGIN + '/'}>Gokan SRS</a>.
    </p>
  </section>
</PageLayout>
