<script lang="ts">
  import type { BrowseGroup } from '../lib/grammarBrowse';
  import { grammarPath, homePath, grammarChaptersIndexPath, grammarConjugationsIndexPath, grammarFamilyPath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  interface Props {
    /** Pre-grouped by family for the static render; the browser regroups client-side. */
    groups: BrowseGroup[];
    total: number;
  }

  let { groups, total }: Props = $props();
</script>

<SiteHeader />

<main>
  <div class="container container--wide">
    <p class="breadcrumb"><a href={homePath()}>Dictionary</a> / Grammar</p>

    <div class="hero">
      <h1>Japanese Grammar Points</h1>
      <p>
        {total.toLocaleString()} grammar points from JLPT N5 to N1, grouped into families of
        near-synonyms so you can compare the ones that actually get confused.
      </p>
      <p class="level-nav">
        <a href={grammarChaptersIndexPath()}>Browse in teaching order (curriculum)</a>
        <a href={grammarConjugationsIndexPath()}>Conjugation reference</a>
      </p>
    </div>

    <!--
      Mount target for the interactive browser (client/grammarBrowser.ts). It replaces the
      static list below once its data loads; if the script never runs, the static list is the
      page, which is what crawlers and no-JS readers get.
    -->
    <div data-grammar-browser></div>

    <div data-grammar-static>
      <!--
        Grouped by family rather than dumped as one flat list. A flat list of 755 points was
        unusable for finding anything: the reader's actual question is "which of these
        near-identical forms do I want", and grouping puts でも/しかし/けれども side by side
        instead of scattering them across five level headings.

        Every point is still linked from here, so each grammar page stays at crawl depth 2.
      -->
      {#each groups as group}
        <section class="card">
          <h2>
            {group.title} <span class="muted">{group.subtitle}</span>
            {#if group.key !== '__unfamilied'}
              <a class="family-group-link" href={grammarFamilyPath(group.key)}>Compare when to use each &rarr;</a>
            {/if}
          </h2>
          <ul class="point-grid">
            {#each group.rows as point}
              <li>
                <a class="point-card" href={grammarPath(point.id)}>
                  <span class="point-card-head">
                    <span class="jp point-card-title">{point.title}</span>
                    <span class="badge">N{point.jlptLevel}</span>
                  </span>
                  {#if point.romaji}<span class="point-card-romaji">{point.romaji}</span>{/if}
                  <span class="point-card-explanation">{point.shortExplanation}</span>
                  <span class="jp point-card-formation">{point.formation}</span>
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  </div>
</main>

<SiteFooter />
