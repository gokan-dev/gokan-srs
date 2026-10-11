<script lang="ts">
  import type { Kanji } from '@gokan/dataset-schema';
  import type { VocabSummary } from '../lib/types';
  import { kanjiIndexPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import Chip from './Chip.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  interface Props {
    kanji: Kanji;
    /** Every word containing the kanji, most frequent first. */
    words: VocabSummary[];
  }

  let { kanji, words }: Props = $props();

  const WORDS_VISIBLE = 30;
  const level = $derived(kanji.steps.jlpt);
</script>

<PageLayout trail={[{ label: 'Kanji', href: kanjiIndexPath() }, { label: kanji.character, jp: true }]} section="kanji" wide>
  <header class="entry-head">
    <h1 class="kanji-glyph" lang="ja">{kanji.character}</h1>
    {#if level}<p class="chips"><Chip label={`JLPT N${level}`} href={`${kanjiIndexPath()}#n${level}`} /></p>{/if}
    <p class="meta">
      {level ? `JLPT N${level}` : 'Outside the JLPT lists'}{#if kanji.steps.kklc}<span class="meta-sep" aria-hidden="true">·</span><abbr title="Kodansha Kanji Learner's Course">KKLC</abbr> #{kanji.steps.kklc}{/if}{#if kanji.frequency}<span class="meta-sep" aria-hidden="true">·</span>Frequency #{kanji.frequency.toLocaleString('en')}{/if}
    </p>
  </header>

  <section class="section">
    <h2>Words with <span lang="ja">{kanji.character}</span></h2>
    {#if words.length > 0}
      <VocabEntryList entries={words} visible={WORDS_VISIBLE} />
    {:else}
      <p class="support">No word in this dictionary uses this kanji yet.</p>
    {/if}
  </section>
</PageLayout>
