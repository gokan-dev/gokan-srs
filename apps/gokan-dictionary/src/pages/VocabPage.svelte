<script lang="ts">
  import { headwordOf, secondaryForm, textbookLessonsLabel } from '@gokan/dataset-schema';
  import type { Sentence, Vocabulary } from '@gokan/dataset-schema';
  import type { VocabSummary } from '../lib/types';
  import { kanjiPath, vocabIndexPath, vocabJlptPath, vocabPath } from '../lib/urls';
  import { segmentSentence } from '../lib/sentenceSegments';
  import PageLayout from './PageLayout.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  interface Props {
    vocab: Vocabulary;
    components: VocabSummary[];
    parents: VocabSummary[];
    sentences: Sentence[];
  }

  let { vocab, components, parents, sentences }: Props = $props();

  function misc_labels(misc: Vocabulary['senses'][number]['misc']): string[] {
    const labels: string[] = [];
    if (misc.isAbbreviation) labels.push('abbreviation');
    if (misc.isPrefix) labels.push('prefix');
    if (misc.isSuffix) labels.push('suffix');
    if (misc.isArchaic) labels.push('archaic');
    if (misc.isRare) labels.push('rare');
    return labels;
  }

  // The single most important fact on the page: what the word means. Lifted into the header
  // beside the word itself, because a reader who searched for this word wants it answered
  // immediately, not after scrolling past the fold to a "Meanings" card.
  const summaryGloss = $derived(vocab.senses.flatMap(sense => sense.glosses).slice(0, 4).join('; '));
  const hasRelated = $derived(
    vocab.writtenForm.containedKanji.length > 0 || components.length > 0 || parents.length > 0,
  );
</script>

<PageLayout trail={[{ label: 'Vocabulary', href: vocabIndexPath() }, { label: headwordOf(vocab), jp: true }]} wide>

  <header class="entry-head">
    <h1 class="entry-word jp">{headwordOf(vocab)}</h1>

    {#if vocab.usuallyKana}
      <!-- Learned in kana (ここ): the headword already is the reading, so name the kanji spelling. -->
      <p class="entry-reading">
        <span class="muted">Usually written in kana. Kanji spelling</span> <span class="jp">{secondaryForm(vocab)}</span>
      </p>
    {:else}
      <p class="entry-reading jp">
        {vocab.reading.primary}
        {#if vocab.reading.alternatives.length > 0}
          <span class="muted">&middot; also {vocab.reading.alternatives.join('、')}</span>
        {/if}
      </p>
    {/if}

    {#if summaryGloss}
      <p class="entry-gloss">{summaryGloss}</p>
    {/if}

    <p class="entry-meta">
      {#if vocab.jlptLevel}<a class="badge" href={vocabJlptPath(vocab.jlptLevel)}>JLPT N{vocab.jlptLevel}</a>{/if}
      {#if vocab.isCommon}<span class="badge badge--plain">common word</span>{/if}
      {#if vocab.textbooks?.length}<span class="badge badge--plain">{textbookLessonsLabel(vocab.textbooks)}</span>{/if}
      {#if vocab.writtenForm.alternatives.length > 0}
        <span class="muted">Also written <span class="jp">{vocab.writtenForm.alternatives.join('、')}</span></span>
      {/if}
    </p>
  </header>

  <!--
    Two columns on a wide viewport, one on a narrow one. The split is by importance, not by
    convenience: the definition and the example sentences are what the page is for and stay in
    the primary column, while the relationship lists (kanji breakdown, compounds) are
    navigation aids and move aside. Previously all five sections were identical full-width
    cards stacked vertically, which gave a word's meaning exactly the same visual weight as
    the list of words it happens to appear inside, and pushed the sentences far down the page.
  -->
  <div class="entry-layout">
    <div class="entry-main">
      <section class="card">
        <h2>Meaning</h2>
        <ol class="sense-list">
          {#each vocab.senses as sense, senseIndex (senseIndex)}
            <li class="sense">
              <div class="pos-tags">
                {#each sense.pos as tag, tagIndex (tagIndex)}<span class="pos-tag">{tag}</span>{/each}
                {#each misc_labels(sense.misc) as label (label)}<span class="pos-tag">{label}</span>{/each}
              </div>
              <span>{sense.glosses.join('; ')}</span>
            </li>
          {/each}
        </ol>
      </section>

      {#if sentences.length > 0}
        <section class="card">
          <h2>Example sentences</h2>
          <ul class="sentence-list">
            {#each sentences as sentence (sentence.id)}
              <li class="sentence">
                <p class="sentence-original jp">
                  <!--
                    Segmented on the dataset's match offsets so every recognised word links to
                    its own entry, matching what grammar example sentences already did. A
                    sentence commonly contains 5-15 resolved words, so this is a large part of
                    what makes the ~36k vocab pages reachable by a crawler, as well as being
                    the natural thing for a reader to want when they hit an unknown word.
                  -->
                  {#each segmentSentence(sentence, vocab.id) as segment, segmentIndex (segmentIndex)}{#if segment.isTarget}<strong class="sentence-target">{segment.text}</strong>{:else if segment.vocabId}<a class="sentence-word" href={vocabPath(segment.vocabId)}>{segment.text}</a>{:else}{segment.text}{/if}{/each}
                </p>
                {#if sentence.en[0]}<p class="sentence-en">{sentence.en[0].text}</p>{/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>

    {#if hasRelated}
      <aside class="entry-aside">
        {#if vocab.writtenForm.containedKanji.length > 0}
          <section class="card">
            <h2>Kanji used</h2>
            <ul class="chip-list">
              {#each vocab.writtenForm.containedKanji as character, characterIndex (characterIndex)}
                <li><a class="chip jp" href={kanjiPath(character)}>{character}</a></li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if components.length > 0}
          <section class="card">
            <h2>Made of</h2>
            <VocabEntryList entries={components} compact />
          </section>
        {/if}

        {#if parents.length > 0}
          <section class="card">
            <h2>Used in</h2>
            <VocabEntryList entries={parents} compact />
          </section>
        {/if}
      </aside>
    {/if}
  </div>
</PageLayout>
