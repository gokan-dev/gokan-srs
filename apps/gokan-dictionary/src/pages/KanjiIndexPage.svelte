<script lang="ts">
  import type { Kanji } from '@gokan/dataset-schema';
  import { homePath, kanjiPath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  interface Props {
    /** Groups in presentation order (N5 first); `level` is null for kanji outside the JLPT lists. */
    groups: { level: number | null; kanji: Kanji[] }[];
  }

  let { groups }: Props = $props();

  const total = $derived(groups.reduce((sum, group) => sum + group.kanji.length, 0));
</script>

<SiteHeader />

<main>
  <div class="container">
    <p class="breadcrumb"><a href={homePath()}>Dictionary</a> / Kanji</p>

    <div class="hero">
      <h1>Kanji Index</h1>
      <p>All {total.toLocaleString()} kanji in the dictionary, grouped by JLPT level.</p>
    </div>

    <!--
      This page is why kanji pages are reachable at all. Before it existed they were linked only
      from the vocab pages that happen to contain them, which left the rarer ones effectively
      orphaned (sitemap-listed, linked from nowhere) - the same problem the grammar index solves
      for grammar points. 2,300 links on one page is well within what a crawler handles.
    -->
    {#each groups as group (group.level)}
      <section class="card">
        <h2>
          {group.level === null ? 'Outside the JLPT lists' : `JLPT N${group.level}`}
          <span class="muted">({group.kanji.length})</span>
        </h2>
        <ul class="glyph-grid">
          {#each group.kanji as kanji (kanji.character)}
            <li><a class="glyph-tile jp" href={kanjiPath(kanji.character)} title={`Kanji ${kanji.character}`}>{kanji.character}</a></li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</main>

<SiteFooter />
