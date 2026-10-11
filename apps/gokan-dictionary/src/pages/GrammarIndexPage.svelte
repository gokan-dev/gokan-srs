<script lang="ts">
  import type { LevelGroup } from '../lib/grammarBrowse';
  import type { GrammarSummary } from '../lib/types';
  import PageLayout from './PageLayout.svelte';
  import GrammarList from './GrammarList.svelte';
  import GrammarTabs from './GrammarTabs.svelte';

  interface Props {
    /** Every point, grouped N5 first, in teaching order within a level. */
    groups: LevelGroup<GrammarSummary>[];
    total: number;
  }

  let { groups, total }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar' }]} section="grammar">
  <div class="page-intro">
    <h1>Japanese grammar</h1>
    <p>{total.toLocaleString('en')} grammar points from JLPT N5 to N1, in the order they are taught.</p>
  </div>

  <GrammarTabs current="level" />

  <!--
    The filter (client/grammarFilter.ts) works over these static rows: no data download. Hidden
    until the script shows it, so a reader without JavaScript never sees controls that do nothing.
  -->
  <div class="grammar-filter" data-grammar-filter hidden>
    <label class="visually-hidden" for="grammar-filter-input">Filter grammar points</label>
    <input id="grammar-filter-input" class="grammar-filter-input" type="search" placeholder="Filter by pattern, romaji or meaning" autocomplete="off" />
    <div class="grammar-filter-levels" role="group" aria-label="Levels">
      {#each groups as group (group.level)}
        <button type="button" class="button" aria-pressed="true" data-level={group.level}>N{group.level}</button>
      {/each}
    </div>
    <p class="meta" role="status" data-grammar-filter-count></p>
  </div>

  {#each groups as group (group.level)}
    <section class="section" id={`n${group.level}`} data-level-section={group.level}>
      <h2>JLPT N{group.level} <span class="meta">{group.items.length}</span></h2>
      <GrammarList points={group.items} />
    </section>
  {/each}
</PageLayout>
