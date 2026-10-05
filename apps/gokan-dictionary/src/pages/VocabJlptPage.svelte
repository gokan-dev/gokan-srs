<script lang="ts">
  import type { VocabSummary } from '../lib/types';
  import { homePath, vocabIndexPath, vocabJlptPath, vocabPath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  interface Props {
    level: number;
    words: VocabSummary[];
    /** Every level, for the cross-links at the foot of the page. */
    allLevels: number[];
  }

  let { level, words, allLevels }: Props = $props();
</script>

<SiteHeader />

<main>
  <div class="container">
    <p class="breadcrumb">
      <a href={homePath()}>Dictionary</a> / <a href={vocabIndexPath()}>Vocabulary</a> / JLPT N{level}
    </p>

    <div class="hero">
      <h1>JLPT N{level} Vocabulary</h1>
      <p>{words.length.toLocaleString()} words, ordered by frequency: the most common first.</p>
    </div>

    <section class="card">
      <ul class="entry-list">
        {#each words as word (word.id)}
          <li>
            <a class="entry-row" href={vocabPath(word.id)}>
              <span class="entry-row-word jp">{word.kanji}</span>
              <span class="entry-row-reading jp">{word.reading}</span>
              <span class="entry-row-gloss">{word.gloss ?? ''}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>

    <nav class="level-nav">
      <span class="muted">Other levels:</span>
      {#each allLevels.filter(other => other !== level) as other (other)}
        <a href={vocabJlptPath(other)}>N{other}</a>
      {/each}
    </nav>
  </div>
</main>

<SiteFooter />
