<script lang="ts">
  import type { SentenceRun } from '../lib/furigana';
  import { vocabPath } from '../lib/urls';

  /**
   * One sentence's Japanese, from its runs (lib/furigana.ts): every recognised word links to its
   * entry with furigana over its kanji, and the page's own word (or a grammar pattern) is the
   * accent current item. Written on one line: whitespace between runs would show in the text.
   */
  interface Props {
    runs: SentenceRun[];
  }

  let { runs }: Props = $props();
</script>

{#snippet text(run: SentenceRun)}{#each run.parts as part, index (index)}{#if part.ruby}<ruby>{part.text}<rt>{part.ruby}</rt></ruby>{:else}{part.text}{/if}{/each}{/snippet}
{#snippet linked(run: SentenceRun)}{#if run.vocabId}<a href={vocabPath(run.vocabId)}>{@render text(run)}</a>{:else}{@render text(run)}{/if}{/snippet}

<p class="sentence-jp" lang="ja">{#each runs as run, index (index)}{#if run.emphasized}<strong>{@render linked(run)}</strong>{:else}{@render linked(run)}{/if}{/each}</p>
