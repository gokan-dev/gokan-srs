<script lang="ts">
  import { frequencyBand, frequencyTop } from '@gokan/dataset-schema';
  import type { RomajiPageProps as Props } from '../lib/pageProps';
  import { romajiSpoken } from '../lib/romaji';
  import type { VocabSummary } from '../lib/types';
  import { pageLocale } from './pageLocale';
  import LinkedText from './LinkedText.svelte';
  import PageLayout from './PageLayout.svelte';
  import PitchAccent from './PitchAccent.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  /**
   * The words one romaji is shared by (#278, lib/romaji.ts): for a learner who typed "hashi" and
   * does not yet know which word they mean. Each a word list row, most frequent first, its reading
   * drawn with its pitch accent, and under its gloss what tells it apart in words: its level, how
   * common it is, its pitch accent.
   */
  let { romaji, words }: Props = $props();

  const { urls, messages } = pageLocale();
  const page = messages.romajiPage;

  const pitchById = $derived(new Map(words.map(word => [word.summary.id, word.pitch])));
  const readings = $derived([...new Set(words.map(word => word.summary.reading ?? word.summary.word))]);
  const entries = $derived(words.map((word): VocabSummary => ({
    ...word.summary,
    note: page.note({ jlpt: word.jlpt, top: frequencyBand(word.rank).ranked ? frequencyTop(word.rank) : null, downsteps: word.pitch?.downsteps }),
  })));
</script>

<!-- One line on purpose: a row's cells are the link's children, with no whitespace between them. -->
{#snippet reading(word: VocabSummary)}{@const pitch = pitchById.get(word.id)}{#if pitch}<span><PitchAccent accent={pitch} /></span>{:else if word.reading}<span>{word.reading}</span>{/if}{/snippet}

<PageLayout trail={[{ label: messages.chrome.sections.vocab, href: urls.vocabIndexPath() }, { label: romaji }]} section="vocab" wide>
  <div class="page-intro">
    <h1><LinkedText parts={page.heading(romaji)} /></h1>
    <p><LinkedText parts={page.intro(words.length, readings, romaji, romajiSpoken(readings, words.map(word => word.pitch)))} /></p>
  </div>

  <section class="section">
    <VocabEntryList {entries} {reading} noteInGloss />
    <p class="meta">{page.outro}</p>
  </section>
</PageLayout>
