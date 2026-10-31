<script lang="ts">
  import { headwordOf, secondaryForm, summaryGloss, textbookLessonsLabel } from '@gokan/dataset-schema';
  import type { Sentence, Vocabulary } from '@gokan/dataset-schema';
  import type { VocabSummary } from '../lib/types';
  import { kanjiPath, vocabIndexPath, vocabJlptPath } from '../lib/urls';
  import { meaningsOf, type SenseView } from '../lib/senses';
  import { sentenceRuns } from '../lib/furigana';
  import { conjugate, wordClassOf } from '../lib/conjugation';
  import { VISIBLE_SENTENCES } from '../lib/sentenceOrder';
  import PageLayout from './PageLayout.svelte';
  import VocabEntryList from './VocabEntryList.svelte';
  import Chip from './Chip.svelte';
  import ConjugationForms from './ConjugationForms.svelte';
  import FuriganaToggle from './FuriganaToggle.svelte';
  import SentenceText from './SentenceText.svelte';

  interface Props {
    vocab: Vocabulary;
    components: VocabSummary[];
    parents: VocabSummary[];
    /** Already ordered and capped (lib/sentenceOrder.ts). */
    sentences: Sentence[];
  }

  let { vocab, components, parents, sentences }: Props = $props();

  const RELATED_VISIBLE = 10;

  const headword = $derived(headwordOf(vocab));
  // The single most important fact on the page, beside the word: a reader who searched for it
  // wants the meaning immediately, not after scrolling to the Meanings section.
  const summary = $derived(summaryGloss(vocab.senses));
  const meanings = $derived(meaningsOf(vocab.senses));
  const commonCount = $derived(meanings.visible.length + meanings.more.length);
  // Only when the headword fits its class: a verb listed under an odd spelling gets no table
  // rather than a wrong one.
  const wordClass = $derived.by(() => {
    const found = wordClassOf(vocab.senses.flatMap(sense => sense.pos));
    return found && conjugate(headword, found).length > 0 ? found : null;
  });
  const shownSentences = $derived(sentences.slice(0, VISIBLE_SENTENCES));
  const moreSentences = $derived(sentences.slice(VISIBLE_SENTENCES));
  const hasRelated = $derived(vocab.writtenForm.containedKanji.length > 0 || components.length > 0 || parents.length > 0);
</script>

{#snippet senseList(views: SenseView[])}
  <ol class="sense-list" start={views[0].number}>
    {#each views as sense (sense.number)}
      <li>
        {#if sense.pos}<p class="sense-pos">{sense.pos}</p>{/if}
        {sense.glosses}{#each sense.labels as label (label)}<span class="sense-label">{label}</span>{/each}
      </li>
    {/each}
  </ol>
{/snippet}

{#snippet sentenceList(list: Sentence[])}
  <ul class="sentence-list">
    {#each list as sentence (sentence.id)}
      <li>
        <SentenceText runs={sentenceRuns(sentence, { targetVocabId: vocab.id })} />
        {#if sentence.en[0]}<p class="sentence-en">{sentence.en[0].text}</p>{/if}
      </li>
    {/each}
  </ul>
{/snippet}

<PageLayout trail={[{ label: 'Vocabulary', href: vocabIndexPath() }, { label: headword, jp: true }]} section="vocab" wide>
  <header class="entry-head">
    <h1 class="entry-word" lang="ja">{headword}</h1>

    {#if vocab.usuallyKana}
      <!-- Learned in kana (ここ): the headword already is the reading, so name the kanji spelling. -->
      <p class="entry-sub">Usually written in kana. Kanji spelling <span lang="ja">{secondaryForm(vocab)}</span></p>
    {:else}
      <p class="entry-sub" lang="ja">{vocab.reading.primary}{#if vocab.reading.alternatives.length > 0}<span class="meta" lang="en"> · also <span lang="ja">{vocab.reading.alternatives.join('、')}</span></span>{/if}</p>
    {/if}

    {#if summary}<p class="entry-gloss">{summary}</p>{/if}

    <p class="chips">
      {#if vocab.jlptLevel}<Chip label={`JLPT N${vocab.jlptLevel}`} href={vocabJlptPath(vocab.jlptLevel)} />{/if}
      {#if vocab.isCommon}<Chip label="Common word" />{/if}
      {#if vocab.textbooks?.length}<Chip label={textbookLessonsLabel(vocab.textbooks)} />{/if}
      {#if vocab.writtenForm.alternatives.length > 0}
        <span class="meta">Also written <span lang="ja">{vocab.writtenForm.alternatives.join('、')}</span></span>
      {/if}
    </p>
  </header>

  <!--
    Two columns on a wide viewport, one on a narrow one, split by importance: the meanings, forms
    and sentences are what the page is for and stay in the main column; the relationship lists
    are navigation aids and move aside.
  -->
  <div class="entry-layout">
    <div class="entry-main">
      <section class="section">
        <h2>Meanings</h2>
        {#if meanings.visible.length > 0}{@render senseList(meanings.visible)}{/if}
        {#if meanings.more.length > 0}
          <details class="disclosure">
            <summary>All {commonCount} meanings</summary>
            {@render senseList(meanings.more)}
          </details>
        {/if}
        {#if meanings.rare.length > 0}
          <details class="disclosure">
            <summary>Rare and archaic meanings ({meanings.rare.length})</summary>
            {@render senseList(meanings.rare)}
          </details>
        {/if}
      </section>

      {#if wordClass}
        <section class="section">
          <h2>Forms</h2>
          <ConjugationForms word={headword} reading={vocab.reading.primary} {wordClass} />
        </section>
      {/if}

      {#if sentences.length > 0}
        <section class="section">
          <div class="section-head">
            <h2>Example sentences</h2>
            <FuriganaToggle />
          </div>
          {@render sentenceList(shownSentences)}
          {#if moreSentences.length > 0}
            <details class="disclosure">
              <summary>More examples ({moreSentences.length})</summary>
              {@render sentenceList(moreSentences)}
            </details>
          {/if}
        </section>
      {/if}
    </div>

    {#if hasRelated}
      <aside class="entry-aside">
        {#if vocab.writtenForm.containedKanji.length > 0}
          <section class="section">
            <h2>Kanji used</h2>
            <ul class="kanji-tiles">
              {#each vocab.writtenForm.containedKanji as character, index (index)}
                <li><a href={kanjiPath(character)} lang="ja">{character}</a></li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if components.length > 0}
          <section class="section">
            <h2>Made of</h2>
            <VocabEntryList entries={components} visible={RELATED_VISIBLE} stacked />
          </section>
        {/if}

        {#if parents.length > 0}
          <section class="section">
            <h2>Used in</h2>
            <VocabEntryList entries={parents} visible={RELATED_VISIBLE} stacked />
          </section>
        {/if}
      </aside>
    {/if}
  </div>
</PageLayout>
