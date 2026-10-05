<script lang="ts">
  import type { Kanji } from '../models/kanji.model';
  import type { VocabSummary } from '../lib/types';
  import { homePath, vocabPath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  interface Props {
    kanji: Kanji;
    vocabList: VocabSummary[];
    vocabTotalCount: number;
  }

  let { kanji, vocabList, vocabTotalCount }: Props = $props();
</script>

<SiteHeader />

<main>
  <div class="container">
    <p class="breadcrumb"><a href={homePath()}>Dictionary</a> / <span class="jp">{kanji.character}</span></p>

    <h1>
      <span class="kanji-glyph kanji-glyph--lg jp">{kanji.character}</span>
      {#if kanji.steps.jlpt}<span class="badge">JLPT N{kanji.steps.jlpt}</span>{/if}
    </h1>

    <p class="stat-row">
      {#if kanji.steps.kklc}<span>KKLC step {kanji.steps.kklc}</span>{/if}
      {#if kanji.frequency}<span>Frequency rank #{kanji.frequency}</span>{/if}
    </p>

    <section class="card">
      <h2>Vocabulary using {kanji.character}</h2>
      {#if vocabList.length > 0}
        <ul class="vocab-list">
          {#each vocabList as word (word.id)}
            <li class="vocab-list-item">
              <a class="jp" href={vocabPath(word.id)}>{word.kanji}</a>
              <span class="muted jp">{word.reading}</span>
              {#if word.gloss}<span class="gloss">{word.gloss}</span>{/if}
            </li>
          {/each}
        </ul>
        {#if vocabTotalCount > vocabList.length}
          <p class="muted">Showing {vocabList.length} of {vocabTotalCount} words.</p>
        {/if}
      {:else}
        <p class="muted">No vocabulary in this dictionary uses this kanji yet.</p>
      {/if}
    </section>
  </div>
</main>

<SiteFooter />
