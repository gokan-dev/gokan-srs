<script lang="ts">
  // The one genuinely interactive view on the site. Written with Svelte 5 runes ($props,
  // $state, $derived) rather than DOM manipulation: filtering 755 rows across a search box,
  // three filter groups and two grouping modes is exactly the kind of derived state runes
  // exist for, and hand-wiring it would mean recomputing and re-rendering groups by hand.
  //
  // Mounted client-side over a server-rendered static list (see client/grammarBrowser.ts).
  // Deliberately mount() rather than hydrate(): the static list is the crawlable, no-JS
  // fallback and is simply replaced once this loads, which sidesteps hydration mismatch
  // entirely and keeps the SSR markup free to differ from the interactive markup.
  import {
    filterRows,
    groupRows,
    JLPT_LEVELS,
    KIND_LABEL,
    FORMALITY_LABEL,
    type GrammarBrowseRow,
    type GrammarKind,
    type GroupMode,
  } from '../lib/grammarBrowse';
  import { grammarPath, grammarFamilyPath } from '../lib/urls';

  interface Props {
    rows: GrammarBrowseRow[];
  }

  let { rows }: Props = $props();

  let query = $state('');
  let levels = $state<number[]>([]);
  let kinds = $state<GrammarKind[]>([]);
  let familiedOnly = $state(false);
  let group = $state<GroupMode>('family');

  const filtered = $derived(filterRows(rows, { query, levels, kinds, familiedOnly }));
  const groups = $derived(groupRows(filtered, group));

  const KINDS: GrammarKind[] = ['construction', 'inflection', 'lexical'];

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
  }

  function reset(): void {
    query = '';
    levels = [];
    kinds = [];
    familiedOnly = false;
  }

  const hasFilters = $derived(
    query.trim() !== '' || levels.length > 0 || kinds.length > 0 || familiedOnly,
  );
</script>

<div class="browser-controls">
  <input
    class="search-input browser-search"
    type="search"
    placeholder="Filter by meaning, pattern, or family: try &quot;contradiction&quot;"
    bind:value={query}
    aria-label="Filter grammar points"
  />

  <div class="filter-row">
    <span class="filter-label">Group by</span>
    <div class="toggle-group">
      <button
        type="button"
        class="toggle"
        class:is-on={group === 'family'}
        onclick={() => (group = 'family')}
      >Family</button>
      <button
        type="button"
        class="toggle"
        class:is-on={group === 'level'}
        onclick={() => (group = 'level')}
      >JLPT level</button>
    </div>
  </div>

  <div class="filter-row">
    <span class="filter-label">Level</span>
    <div class="toggle-group">
      {#each JLPT_LEVELS as level (level)}
        <button
          type="button"
          class="toggle"
          class:is-on={levels.includes(level)}
          onclick={() => (levels = toggle(levels, level))}
        >N{level}</button>
      {/each}
    </div>
  </div>

  <div class="filter-row">
    <span class="filter-label">Type</span>
    <div class="toggle-group">
      {#each KINDS as kind (kind)}
        <button
          type="button"
          class="toggle"
          class:is-on={kinds.includes(kind)}
          onclick={() => (kinds = toggle(kinds, kind))}
        >{KIND_LABEL[kind]}</button>
      {/each}
      <button
        type="button"
        class="toggle"
        class:is-on={familiedOnly}
        onclick={() => (familiedOnly = !familiedOnly)}
      >Has synonyms</button>
    </div>
  </div>

  <p class="browser-count">
    {filtered.length} of {rows.length} points
    {#if hasFilters}
      <button type="button" class="link-button" onclick={reset}>Clear filters</button>
    {/if}
  </p>
</div>

{#each groups as browseGroup (browseGroup.key)}
  <section class="card">
    <h2>
      {browseGroup.title}
      <span class="muted">{browseGroup.subtitle}</span>
      {#if group === 'family' && browseGroup.key !== '__unfamilied'}
        <a class="family-group-link" href={grammarFamilyPath(browseGroup.key)}>Compare when to use each &rarr;</a>
      {/if}
    </h2>
    <ul class="point-grid">
      {#each browseGroup.rows as point (point.id)}
        <li>
          <a class="point-card" href={grammarPath(point.id)}>
            <span class="point-card-head">
              <span class="jp point-card-title">{point.title}</span>
              <span class="badge">N{point.jlptLevel}</span>
            </span>
            {#if point.romaji}<span class="point-card-romaji">{point.romaji}</span>{/if}
            <span class="point-card-explanation">{point.shortExplanation}</span>
            <span class="jp point-card-formation">{point.formation}</span>
            {#if point.usageNote}<span class="point-card-note">{point.usageNote}</span>{/if}
            <span class="point-card-chips">
              {#if point.kind}<span class="chip-sm">{KIND_LABEL[point.kind]}</span>{/if}
              {#if point.formalityLevel}
                <span class="chip-sm">{FORMALITY_LABEL[point.formalityLevel] ?? point.formalityLevel}</span>
              {/if}
              {#if group === 'level' && point.familyName}
                <span class="chip-sm">{point.familyName}</span>
              {/if}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{:else}
  <section class="card">
    <p class="muted">No grammar points match those filters.</p>
    <button type="button" class="link-button" onclick={reset}>Clear filters</button>
  </section>
{/each}
