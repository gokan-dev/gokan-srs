<script lang="ts">
  import type { Kanji } from '@gokan/dataset-schema';
  import { kanjiOrdersPath, kanjiPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';

  interface Props {
    /** Groups in presentation order (N5 first); `level` is null for kanji outside the JLPT lists. */
    groups: { level: number | null; kanji: Kanji[] }[];
  }

  let { groups }: Props = $props();

  const total = $derived(groups.reduce((sum, group) => sum + group.kanji.length, 0));
  const idOf = (level: number | null) => (level === null ? 'outside-jlpt' : `n${level}`);
  const labelOf = (level: number | null) => (level === null ? 'Outside JLPT' : `JLPT N${level}`);
</script>

<PageLayout trail={[{ label: 'Kanji' }]} section="kanji" wide>
  <div class="page-intro">
    <h1>Kanji</h1>
    <p>All {total.toLocaleString('en')} kanji in the dictionary, grouped by JLPT level.</p>
    <p>Following a kanji book? <a href={kanjiOrdersPath()}>See the words each step of its order unlocks</a>.</p>
  </div>

  <nav class="level-nav" aria-label="Levels">
    {#each groups as group (group.level)}
      <a href={`#${idOf(group.level)}`}>{group.level === null ? 'Outside JLPT' : `N${group.level}`}</a>
    {/each}
  </nav>

  <!--
    This page is why kanji pages are reachable at all: before it they were linked only from the
    words that contain them, which left the rarer ones orphaned. Each tile's accessible name
    is "学, JLPT N5": the level is visually hidden, the character read in Japanese.
  -->
  {#each groups as group (group.level)}
    <section class="section kanji-level" id={idOf(group.level)} style={`--tiles: ${group.kanji.length}`}>
      <h2>{labelOf(group.level)} <span class="meta">{group.kanji.length}</span></h2>
      <ul class="glyph-grid">
        {#each group.kanji as kanji (kanji.character)}
          <li><a href={kanjiPath(kanji.character)}><span lang="ja">{kanji.character}</span><span class="visually-hidden">, {labelOf(group.level)}</span></a></li>
        {/each}
      </ul>
    </section>
  {/each}
</PageLayout>
