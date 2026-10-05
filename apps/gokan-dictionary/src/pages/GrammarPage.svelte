<script lang="ts">
  import type { GrammarExample, GrammarPoint } from '../models/grammar.model';
  import type { GrammarSummary } from '../lib/types';
  import type { ChapterLocator } from '../lib/grammarChapters';
  import type { VariantSibling } from '../lib/grammarVariants';
  import type { GrammarConjugationIndex } from '../models/grammar.model';
  import { grammarChapterPath, grammarFamilyPath, grammarPath, homePath, vocabPath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  interface Props {
    point: GrammarPoint;
    related: GrammarSummary[];
    /** Where this point sits in the teaching order (issue #58); null when it isn't in it (e.g. a non-canonical variant realization). */
    chapterLocator: ChapterLocator | null;
    /** This point's realization variants, e.g. それでは/それじゃ/じゃ; [] when it has none (issue #58). */
    variants: VariantSibling[];
    /** This point's conjugation drill table, for `kind: 'inflection'` points that have one (issue #58). */
    conjugation: GrammarConjugationIndex[string] | null;
    /** Capped corpus-mined sentence pool (issue #73), already truncated to MAX_MINED_EXAMPLES; [] when the point has no pool. */
    minedExamples: GrammarExample[];
    /** The pool's true size before truncation, for the "Showing N of total" note. */
    minedExamplesTotalCount: number;
  }

  let { point, related, chapterLocator, variants, conjugation, minedExamples, minedExamplesTotalCount }: Props = $props();

  const RELATION_LABEL: Record<string, string> = {
    canonical: 'Base form',
    contraction: 'Contraction',
    politeness: 'Politeness',
    particle: 'Particle',
    'particle+politeness': 'Particle + politeness',
  };

  const FORMALITY_LABELS: Record<NonNullable<GrammarPoint['formalityLevel']>, string> = {
    casual: 'Casual',
    neutral: 'Neutral',
    polite: 'Polite',
    formal: 'Formal',
    'very-formal-literary': 'Very formal / literary',
  };
</script>

<SiteHeader />

<main>
  <div class="container">
    <p class="breadcrumb"><a href={homePath()}>Dictionary</a> / Grammar / <span class="jp">{point.title}</span></p>

    <h1>
      <span class="jp">{point.title}</span>
      <span class="badge">JLPT N{point.jlptLevel}</span>
      {#if point.formalityLevel}<span class="badge">{FORMALITY_LABELS[point.formalityLevel]}</span>{/if}
    </h1>

    {#if point.romaji}
      <p class="readings muted">{point.romaji}</p>
    {/if}

    {#if chapterLocator}
      <p class="muted">
        <a href={grammarChapterPath(chapterLocator.chapterId)}>
          Chapter {chapterLocator.chapterNumber}: {chapterLocator.chapterTitle}
        </a>
        &middot; {chapterLocator.positionInChapter} of {chapterLocator.totalInChapter}
      </p>
    {/if}

    <p>{point.shortExplanation}</p>

    {#if point.usageNote}
      <p class="muted">{point.usageNote}</p>
    {/if}

    <section class="card">
      <h2>Formation</h2>
      <p class="jp formation">{point.formation}</p>
    </section>

    {#if conjugation}
      <section class="card">
        <h2>Conjugation: {conjugation.formLabel}</h2>
        <table class="conjugation-table">
          <thead>
            <tr>
              <th>Dictionary form</th>
              <th>{conjugation.formLabel}</th>
            </tr>
          </thead>
          <tbody>
            {#each conjugation.items as item (item.vocabId)}
              <tr>
                <td>
                  <a class="jp" href={vocabPath(item.vocabId)}>{item.lemma}</a>
                  <span class="muted">{item.lemmaReading}</span>
                </td>
                <td>
                  <span class="jp">{item.target}</span>
                  <span class="muted">{item.targetReading}</span>
                  {#if item.alternatives && item.alternatives.length > 0}
                    <span class="muted">({item.alternatives.join('、')})</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if variants.length > 0}
      <section class="card">
        <h2>Other forms</h2>
        <ul class="vocab-list">
          {#each variants as variant (variant.id)}
            <li class="vocab-list-item">
              <a class="jp" href={grammarPath(variant.id)}>{variant.title}</a>
              <span class="muted">{RELATION_LABEL[variant.relation] ?? variant.relation}</span>
              <span class="muted">JLPT N{variant.jlptLevel}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if point.longExplanation && point.longExplanation !== point.shortExplanation}
      <section class="card">
        <h2>Explanation</h2>
        <p>{point.longExplanation}</p>
      </section>
    {/if}

    {#if point.examples.length > 0}
      <section class="card">
        <h2>Example sentences</h2>
        <ul class="sentence-list">
          {#each point.examples as example, exampleIndex (exampleIndex)}
            <li class="sentence">
              <p class="sentence-original jp">
                <!--
                  Rendered word-by-word rather than as `example.jp` so every word the dataset
                  resolved to a vocab id becomes a link to its dictionary page. Concatenating
                  the surfaces reconstructs `jp` exactly (an invariant the dataset guarantees),
                  so this is a lossless swap that buys a large internal link graph: it is what
                  makes the ~36k vocab pages reachable by a crawler from grammar pages, instead
                  of only from kanji pages and the search box.
                -->
                {#each example.words as word, wordIndex (wordIndex)}{#if word.vocabId}<a class="sentence-word" href={vocabPath(word.vocabId)}>{word.surface}</a>{:else}{word.surface}{/if}{/each}
              </p>
              <p class="sentence-en">{example.en}</p>
              {#if example.romaji}<p class="sentence-en muted">{example.romaji}</p>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if minedExamples.length > 0}
      <section class="card">
        <h2>Corpus examples</h2>
        <ul class="sentence-list">
          {#each minedExamples as example, exampleIndex (exampleIndex)}
            <li class="sentence">
              <p class="sentence-original jp">
                <!-- Same word-by-word linked rendering as the curated examples above - these
                     corpus-mined sentences are the biggest new source of internal vocab links. -->
                {#each example.words as word, wordIndex (wordIndex)}{#if word.vocabId}<a class="sentence-word" href={vocabPath(word.vocabId)}>{word.surface}</a>{:else}{word.surface}{/if}{/each}
              </p>
              <p class="sentence-en">{example.en}</p>
              {#if example.romaji}<p class="sentence-en muted">{example.romaji}</p>{/if}
            </li>
          {/each}
        </ul>
        {#if minedExamplesTotalCount > minedExamples.length}
          <p class="muted">Showing {minedExamples.length} of {minedExamplesTotalCount} corpus examples.</p>
        {/if}
      </section>
    {/if}

    {#if related.length > 0}
      <section class="card">
        <h2>{point.family?.name ?? 'Related points'}</h2>
        <ul class="vocab-list">
          {#each related as other (other.id)}
            <li class="vocab-list-item">
              <a class="jp" href={grammarPath(other.id)}>{other.title}</a>
              <span class="muted">JLPT N{other.jlptLevel}</span>
            </li>
          {/each}
        </ul>
        {#if point.family}
          <p class="family-link"><a href={grammarFamilyPath(point.family.id)}>Compare when to use each &rarr;</a></p>
        {/if}
      </section>
    {/if}
  </div>
</main>

<SiteFooter />
