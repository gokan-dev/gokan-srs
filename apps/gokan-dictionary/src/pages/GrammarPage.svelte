<script lang="ts">
  import type { GrammarConjugationIndex, GrammarExample, GrammarPoint } from '@gokan/dataset-schema';
  import type { GrammarSummary } from '../lib/types';
  import type { ChapterLocator } from '../lib/grammarChapters';
  import { RELATION_LABELS, type VariantSibling } from '../lib/grammarVariants';
  import { FORMALITY_LABELS } from '../lib/grammarBrowse';
  import { grammarChapterPath, grammarFamilyPath, grammarIndexPath, grammarPath, vocabPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import Chip from './Chip.svelte';
  import FuriganaToggle from './FuriganaToggle.svelte';
  import GrammarExamples from './GrammarExamples.svelte';
  import GrammarList from './GrammarList.svelte';

  interface Props {
    point: GrammarPoint;
    related: GrammarSummary[];
    /** Where this point sits in the teaching order; null when it isn't in it (a non-canonical variant). */
    chapterLocator: ChapterLocator | null;
    /** This point's realization variants, e.g. それでは/それじゃ/じゃ; [] when it has none. */
    variants: VariantSibling[];
    /** This point's conjugation drill table, for `kind: 'inflection'` points that have one. */
    conjugation: GrammarConjugationIndex[string] | null;
    /** Capped corpus-mined sentence pool; [] when the point has none. */
    minedExamples: GrammarExample[];
    /** The pool's true size before the cap. */
    minedExamplesTotalCount: number;
  }

  let { point, related, chapterLocator, variants, conjugation, minedExamples, minedExamplesTotalCount }: Props = $props();

  const hasLongExplanation = $derived(
    point.longExplanation.trim() !== '' && point.longExplanation.trim() !== point.shortExplanation.trim(),
  );
</script>

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: point.title, jp: true }]} section="grammar" wide>
  <header class="entry-head">
    <h1 lang="ja">{point.title}</h1>
    {#if point.romaji}<p class="entry-sub">{point.romaji}</p>{/if}
    <p class="chips">
      <Chip label={`JLPT N${point.jlptLevel}`} href={`${grammarIndexPath()}#n${point.jlptLevel}`} />
      {#if point.formalityLevel}<Chip label={FORMALITY_LABELS[point.formalityLevel]} />{/if}
      {#if chapterLocator}
        <span class="meta">
          <a href={grammarChapterPath(chapterLocator.chapterId)}>Chapter {chapterLocator.chapterNumber}: {chapterLocator.chapterTitle}</a>,
          {chapterLocator.positionInChapter} of {chapterLocator.totalInChapter}
        </span>
      {/if}
    </p>
  </header>

  <div class="grammar-body">
    <section class="formation" aria-label="Formation">
      <h2 class="formation-label">Formation</h2>
      <p lang="ja">{point.formation}</p>
    </section>

    <p class="lead">{point.shortExplanation}</p>

    {#if point.usageNote}
      <section class="section">
        <h2>When to use</h2>
        <p>{point.usageNote}</p>
      </section>
    {/if}

    {#if hasLongExplanation}
      <section class="section">
        <h2>Explanation</h2>
        <p>{point.longExplanation}</p>
      </section>
    {/if}

    {#if point.examples.length > 0}
      <section class="section">
        <div class="section-head">
          <h2>Example sentences</h2>
          <FuriganaToggle />
        </div>
        <GrammarExamples examples={point.examples} idPrefix="example-" />
      </section>
    {/if}

    {#if conjugation}
      <section class="section">
        <h2>Conjugation: {conjugation.formLabel}</h2>
        <table class="conjugation-table">
          <thead>
            <tr><th scope="col">Dictionary form</th><th scope="col">{conjugation.formLabel}</th></tr>
          </thead>
          <tbody>
            {#each conjugation.items as item (item.vocabId)}
              <tr>
                <td><a href={vocabPath(item.vocabId)} lang="ja">{item.lemma}</a> <small lang="ja">{item.lemmaReading}</small></td>
                <td>
                  <span lang="ja">{item.target}</span> <small lang="ja">{item.targetReading}</small>
                  {#if item.alternatives && item.alternatives.length > 0}<small>(<span lang="ja">{item.alternatives.join('、')}</span>)</small>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}

    {#if variants.length > 0}
      <section class="section">
        <h2>Other forms</h2>
        <ul class="grammar-list">
          {#each variants as variant (variant.id)}
            <li><a href={grammarPath(variant.id)}><span lang="ja">{variant.title}</span><small>{RELATION_LABELS[variant.relation] ?? variant.relation}</small><small>N{variant.jlptLevel}</small></a></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if related.length > 0}
      <section class="section">
        <h2>{point.family?.name ?? 'Related points'}</h2>
        <GrammarList points={related} showLevel />
        {#if point.family}
          <p class="family-link"><a href={grammarFamilyPath(point.family.id)}>Compare when to use each</a></p>
        {/if}
      </section>
    {/if}

    {#if minedExamples.length > 0}
      <section class="section">
        <details class="disclosure">
          <summary>Corpus examples ({minedExamplesTotalCount})</summary>
          <GrammarExamples examples={minedExamples} idPrefix="corpus-" />
          {#if minedExamplesTotalCount > minedExamples.length}
            <p class="meta">Showing {minedExamples.length} of {minedExamplesTotalCount} corpus examples.</p>
          {/if}
        </details>
      </section>
    {/if}
  </div>
</PageLayout>
