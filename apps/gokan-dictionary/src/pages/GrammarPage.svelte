<script lang="ts">
  import type { GrammarPageProps as Props } from '../lib/pageProps';
  import { langOf } from '../lib/documentShell';
  import { RELATION_LABELS } from '../lib/grammarVariants';
  import { FORMALITY_LABELS } from '../lib/grammarBrowse';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';
  import Chip from './Chip.svelte';
  import FuriganaToggle from './FuriganaToggle.svelte';
  import GrammarExamples from './GrammarExamples.svelte';
  import GrammarList from './GrammarList.svelte';

  const { urls, messages } = pageLocale();

  let { point, related, chapterLocator, variants, conjugation, minedExamples, minedExamplesTotalCount }: Props = $props();

  const hasLongExplanation = $derived(
    point.longExplanation.trim() !== '' && point.longExplanation.trim() !== point.shortExplanation.trim(),
  );
</script>

<PageLayout trail={[{ label: messages.chrome.sections.grammar, href: urls.grammarIndexPath() }, { label: point.title, jp: true }]} section="grammar" wide>
  <header class="entry-head">
    <h1 lang="ja">{point.title}</h1>
    {#if point.romaji}<p class="entry-sub">{point.romaji}</p>{/if}
    <p class="chips">
      <Chip label={`JLPT N${point.jlptLevel}`} href={`${urls.grammarIndexPath()}#n${point.jlptLevel}`} />
      {#if point.formalityLevel}<Chip label={FORMALITY_LABELS[point.formalityLevel]} />{/if}
      {#if chapterLocator}
        <span class="meta">
          <a href={urls.grammarChapterPath(chapterLocator.chapterId)}>Chapter {chapterLocator.chapterNumber}: <span lang={langOf(chapterLocator.chapterTitle)}>{chapterLocator.chapterTitle}</span></a>,
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
                <td><a href={urls.vocabPath(item.vocabId)} lang="ja">{item.lemma}</a> <small lang="ja">{item.lemmaReading}</small></td>
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
            <li><a href={urls.grammarPath(variant.id)}><span lang="ja">{variant.title}</span><small>{RELATION_LABELS[variant.relation] ?? variant.relation}</small><small>N{variant.jlptLevel}</small></a></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if related.length > 0}
      <section class="section">
        <h2>{point.family?.name ?? 'Related points'}</h2>
        <GrammarList points={related} showLevel />
        {#if point.family}
          <p class="family-link"><a href={urls.grammarFamilyPath(point.family.id)}>Compare when to use each</a></p>
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
