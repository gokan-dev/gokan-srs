<script lang="ts">
  import type { VocabSummary } from '../lib/types';
  import { vocabIndexPath, vocabJlptPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  interface Props {
    level: number;
    words: VocabSummary[];
    /** Every level, for the cross-links at the foot of the page. */
    allLevels: number[];
  }

  let { level, words, allLevels }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Vocabulary', href: vocabIndexPath() }, { label: `JLPT N${level}` }]}>

  <div class="hero">
    <h1>JLPT N{level} Vocabulary</h1>
    <p>{words.length.toLocaleString()} words, ordered by frequency: the most common first.</p>
  </div>

  <section class="card">
    <VocabEntryList entries={words} />
  </section>

  <nav class="level-nav">
    <span class="muted">Other levels:</span>
    {#each allLevels.filter(other => other !== level) as other (other)}
      <a href={vocabJlptPath(other)}>N{other}</a>
    {/each}
  </nav>
</PageLayout>
