<script lang="ts">
  import type { GrammarSummary } from '../lib/types';
  import { grammarPath } from '../lib/urls';

  /**
   * Grammar points as compact rows: title, romaji, and the short explanation under them. The
   * grammar index, the families index, a chapter and a family page all list points this way.
   */
  interface Props {
    points: GrammarSummary[];
    /** Add each point's level, where the list mixes levels. */
    showLevel?: boolean;
  }

  let { points, showLevel = false }: Props = $props();
</script>

<ul class="grammar-list">
  {#each points as point (point.id)}
    <li><a href={grammarPath(point.id)}><span lang="ja">{point.title}</span>{#if point.romaji}<small>{point.romaji}</small>{/if}{#if showLevel}<small>N{point.jlptLevel}</small>{/if}{#if point.shortExplanation}<span>{point.shortExplanation}</span>{/if}</a></li>
  {/each}
</ul>
