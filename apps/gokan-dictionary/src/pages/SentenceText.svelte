<script lang="ts">
  import type { AudioRef } from '@gokan/dataset-schema';
  import type { SentenceRun } from '../lib/furigana';
  import type { PageVoice } from '../lib/pageProps';
  import PlayButton from './PlayButton.svelte';
  import { pageLocale } from './pageLocale';

  const { urls, messages } = pageLocale();

  /**
   * One sentence's Japanese, from its runs (lib/furigana.ts): every recognised word links to its
   * entry with furigana over its kanji, and the page's own word (or a grammar pattern) is the
   * accent current item. Written on one line: whitespace between runs would show in the text.
   * With a clip, its play button sits beside it at its first line (`.play-row`, a right-hand
   * column the sentence never wraps under).
   */
  interface Props {
    runs: SentenceRun[];
    audio?: AudioRef;
    voice?: PageVoice;
  }

  let { runs, audio, voice = null }: Props = $props();
</script>

{#snippet text(run: SentenceRun)}{#each run.parts as part, index (index)}{#if part.ruby}<ruby data-ruby-fallback={part.fallback}>{part.text}<rt>{part.ruby}</rt></ruby>{:else}{part.text}{/if}{/each}{/snippet}
{#snippet linked(run: SentenceRun)}{#if run.vocabId}<a href={urls.vocabPath(run.vocabId)}>{@render text(run)}</a>{:else}{@render text(run)}{/if}{/snippet}
{#snippet sentence()}<p class="sentence-jp" lang="ja">{#each runs as run, index (index)}{#if run.emphasized}<strong>{@render linked(run)}</strong>{:else}{@render linked(run)}{/if}{/each}</p>{/snippet}

{#if audio && voice}<div class="play-row">{@render sentence()}<PlayButton {audio} {voice} label={messages.chrome.playSentence} /></div>{:else}{@render sentence()}{/if}
