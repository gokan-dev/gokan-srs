<script lang="ts">
  import { homePath, vocabJlptPath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  interface Props {
    levels: { level: number; count: number }[];
    totalCount: number;
  }

  let { levels, totalCount }: Props = $props();

  const JLPT_BLURBS: Record<number, string> = {
    5: 'The first level: everyday words, basic verbs, and core vocabulary.',
    4: 'Common daily vocabulary, building on N5.',
    3: 'The bridge to intermediate Japanese.',
    2: 'Upper-intermediate vocabulary for news, work, and study.',
    1: 'Advanced and specialised vocabulary.',
  };
</script>

<SiteHeader />

<main>
  <div class="container">
    <p class="breadcrumb"><a href={homePath()}>Dictionary</a> / Vocabulary</p>

    <div class="hero">
      <h1>Vocabulary</h1>
      <p>
        {totalCount.toLocaleString()} words with readings, meanings, and example sentences.
        Search from the box above, or browse the JLPT lists below.
      </p>
    </div>

    <!--
      Browsing is split one page per JLPT level rather than one page listing every word: only
      about 6,400 of the ~36,000 entries carry a JLPT level at all, and even those would make a
      single page unreasonably long. The other ~30,000 are reachable through search, through the
      kanji pages that contain them, and through the example sentences on grammar pages.
    -->
    <ul class="browse-grid">
      {#each levels as { level, count } (level)}
        <li>
          <a class="browse-tile" href={vocabJlptPath(level)}>
            <span class="browse-tile-title">JLPT N{level}</span>
            <span class="browse-tile-count">{count.toLocaleString()} words</span>
            <span class="browse-tile-blurb">{JLPT_BLURBS[level]}</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</main>

<SiteFooter />
