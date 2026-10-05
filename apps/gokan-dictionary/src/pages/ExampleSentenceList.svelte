<script lang="ts">
  import type { GrammarExample } from '@gokan/dataset-schema';
  import { vocabPath } from '../lib/urls';

  /**
   * Grammar example sentences, curated or corpus-mined alike.
   *
   * Rendered word-by-word rather than as `example.jp` so every word the dataset resolved to
   * a vocab id becomes a link to its dictionary page. Concatenating the surfaces
   * reconstructs `jp` exactly (an invariant the dataset guarantees), so this is a lossless
   * swap that buys a large internal link graph: it is what makes the ~36k vocab pages
   * reachable by a crawler from grammar pages, instead of only from kanji pages and search.
   */
  interface Props {
    examples: GrammarExample[];
  }

  let { examples }: Props = $props();
</script>

<ul class="sentence-list">
  {#each examples as example, exampleIndex (exampleIndex)}
    <li class="sentence">
      <p class="sentence-original jp">
        {#each example.words as word, wordIndex (wordIndex)}{#if word.vocabId}<a class="sentence-word" href={vocabPath(word.vocabId)}>{word.surface}</a>{:else}{word.surface}{/if}{/each}
      </p>
      <p class="sentence-en">{example.en}</p>
      {#if example.romaji}<p class="sentence-en muted">{example.romaji}</p>{/if}
    </li>
  {/each}
</ul>
