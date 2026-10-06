<script lang="ts">
  import type { GrammarConjugationIndex, GrammarExample, GrammarPoint } from '@gokan/dataset-schema';
  import type { GrammarSummary } from '../lib/types';
  import type { ChapterLocator } from '../lib/grammarChapters';
  import type { VariantSibling } from '../lib/grammarVariants';
  import { grammarChapterPath, grammarFamilyPath, grammarIndexPath, grammarPath, vocabPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import ExampleSentenceList from './ExampleSentenceList.svelte';

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

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: point.title, jp: true }]}>

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
      <ExampleSentenceList examples={point.examples} />
    </section>
  {/if}

  {#if minedExamples.length > 0}
    <section class="card">
      <h2>Corpus examples</h2>
      <ExampleSentenceList examples={minedExamples} />
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
</PageLayout>
