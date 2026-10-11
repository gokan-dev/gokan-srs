<script lang="ts">
  import { vocabJlptPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';

  interface Props {
    levels: { level: number; count: number }[];
    totalCount: number;
  }

  let { levels, totalCount }: Props = $props();

  const JLPT_BLURBS: Record<number, string> = {
    5: 'Everyday words, basic verbs and core vocabulary.',
    4: 'Common daily vocabulary, building on N5.',
    3: 'The bridge to intermediate Japanese.',
    2: 'Vocabulary for news, work and study.',
    1: 'Advanced and specialised vocabulary.',
  };
</script>

<PageLayout trail={[{ label: 'Vocabulary' }]} section="vocab" wide>
  <div class="page-intro">
    <h1>Vocabulary</h1>
    <p>
      {totalCount.toLocaleString('en')} words with readings, meanings and example sentences. Browse
      the JLPT lists, or search for any word.
    </p>
  </div>

  <!--
    One list per JLPT level: only about 6,400 of the ~36,000 entries carry a level. The others are
    reachable through search, the kanji pages that contain them, and the example sentences.
  -->
  <ul class="tiles" style={`--tiles: ${levels.length}`}>
    {#each levels as { level, count } (level)}
      <li>
        <a class="tile" href={vocabJlptPath(level)}>
          <span class="tile-title">JLPT N{level}</span>
          <span class="tile-meta">{count.toLocaleString('en')} words</span>
          <span class="tile-blurb">{JLPT_BLURBS[level]}</span>
        </a>
      </li>
    {/each}
  </ul>
</PageLayout>
