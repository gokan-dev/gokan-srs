<script lang="ts">
  import type { VocabSummary } from '../lib/types';
  import { vocabIndexPath, vocabJlptPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import Pager from './Pager.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  interface Props {
    level: number;
    /** This page's words, in frequency order. */
    words: VocabSummary[];
    /** The level's word count across every page. */
    total: number;
    page: number;
    pageCount: number;
    /** 1-based rank of this page's first word. */
    firstRank: number;
    /** Every level, for the cross-links at the foot of the page. */
    allLevels: number[];
  }

  let { level, words, total, page, pageCount, firstRank, allLevels }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Vocabulary', href: vocabIndexPath() }, { label: `JLPT N${level}`, href: page > 1 ? vocabJlptPath(level) : undefined }, ...(page > 1 ? [{ label: `Page ${page}` }] : [])]} section="vocab" wide>
  <div class="page-intro">
    <h1>JLPT N{level} vocabulary{page > 1 ? `, page ${page}` : ''}</h1>
    <p>
      {total.toLocaleString('en')} words, most frequent first.
      {#if pageCount > 1}Words {firstRank.toLocaleString('en')} to {(firstRank + words.length - 1).toLocaleString('en')}.{/if}
    </p>
  </div>

  <Pager count={pageCount} current={page} hrefOf={(p: number) => vocabJlptPath(level, p)} label="Pages" />

  <VocabEntryList entries={words} />

  <Pager count={pageCount} current={page} hrefOf={(p: number) => vocabJlptPath(level, p)} label="Pages" />

  <nav class="level-nav" aria-label="Other levels">
    <span class="meta">Other levels:</span>
    {#each allLevels.filter(other => other !== level) as other (other)}
      <a href={vocabJlptPath(other)}>N{other}</a>
    {/each}
  </nav>
</PageLayout>
