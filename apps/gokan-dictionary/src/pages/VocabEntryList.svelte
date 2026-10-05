<script lang="ts">
  import type { VocabSummary } from '../lib/types';
  import { vocabPath } from '../lib/urls';

  /**
   * A list of words linking to their pages: written form, reading and (unless compact)
   * the leading gloss. Shared by every page that lists words, so a word row looks and
   * links the same everywhere.
   */
  interface Props {
    entries: VocabSummary[];
    /** Narrow two-column rows without the gloss, for an aside. */
    compact?: boolean;
  }

  let { entries, compact = false }: Props = $props();
</script>

<ul class="entry-list" class:entry-list--compact={compact}>
  {#each entries as word (word.id)}
    <li>
      <a class="entry-row" href={vocabPath(word.id)}>
        <span class="entry-row-word jp">{word.kanji}</span>
        <span class="entry-row-reading jp">{word.reading}</span>
        {#if !compact}<span class="entry-row-gloss">{word.gloss ?? ''}</span>{/if}
      </a>
    </li>
  {/each}
</ul>
