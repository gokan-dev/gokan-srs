<script lang="ts">
  import { grammarExampleToSentence, patternHighlightRanges } from '@gokan/dataset-schema';
  import type { GrammarExample } from '@gokan/dataset-schema';
  import { sentenceRuns } from '../lib/furigana';
  import SentenceText from './SentenceText.svelte';

  /**
   * Grammar example sentences, curated or corpus-mined alike, through the same adapter and
   * segmenter as gokan-srs's grammar pages: every resolved word links to its entry with
   * furigana, the point's pattern is the accent current item, and the translation and romaji
   * follow. These links are a large part of what makes the ~36k word pages reachable by a crawler.
   */
  interface Props {
    examples: GrammarExample[];
    /** Distinguishes two lists on one page, so sentence ids stay unique. */
    idPrefix: string;
  }

  let { examples, idPrefix }: Props = $props();
</script>

<ul class="sentence-list">
  {#each examples as example, index (index)}
    <li>
      <SentenceText runs={sentenceRuns(grammarExampleToSentence(example, `${idPrefix}${index}`), { highlightRanges: patternHighlightRanges(example) })} />
      <p class="sentence-en">{example.en}</p>
      {#if example.romaji}<p class="sentence-romaji">{example.romaji}</p>{/if}
    </li>
  {/each}
</ul>
