<script lang="ts">
  import type { GrammarPageProps as Props } from '../lib/pageProps';
  import { langOf } from '../lib/documentShell';
  import { RELATION_LABELS } from '../lib/grammarVariants';
  import { FORMALITY_LABELS } from '../lib/grammarBrowse';
  import { pageLocale } from './pageLocale';
  import { appUrl } from '../lib/appLinks';
  import AppPanel from './AppPanel.svelte';
  import PageLayout from './PageLayout.svelte';
  import Chip from './Chip.svelte';
  import DetailTabs from './DetailTabs.svelte';
  import FuriganaToggle from './FuriganaToggle.svelte';
  import GrammarExamples from './GrammarExamples.svelte';
  import GrammarList from './GrammarList.svelte';
  import SectionSearch from './SectionSearch.svelte';

  const { urls, messages } = pageLocale();

  let { point, related, chapterLocator, variants, conjugation, minedExamples, minedExamplesTotalCount, voice }: Props = $props();

  /** The Point tab's preview of Examples, as the app's. */
  const POINT_EXAMPLES = 2;
  /**
   * Examples is searchable past this many curated examples, or as soon as it has any corpus example
   * (folded in a disclosure, so its rows are out of sight). Nothing is paged: every row ships.
   */
  const EXAMPLES_VISIBLE = 5;

  const hasLongExplanation = $derived(
    point.longExplanation.trim() !== '' && point.longExplanation.trim() !== point.shortExplanation.trim(),
  );
  /** The rows this page ships: what makes Examples a tab, a preview and searchable. */
  const exampleCount = $derived(point.examples.length + minedExamples.length);
  /** Every example, the corpus counted in full as its disclosure counts it: what "All N examples" says. */
  const allExampleCount = $derived(point.examples.length + minedExamplesTotalCount);
  const hasRelated = $derived(conjugation !== null || variants.length > 0 || related.length > 0);

  /** The sections, in the app grammar page's names and order (DetailTabs). */
  const tabs = $derived([
    { id: 'point', label: messages.detailTabs.point },
    ...(exampleCount > 0 ? [{ id: 'examples', label: messages.detailTabs.examples }] : []),
    ...(hasRelated ? [{ id: 'related', label: messages.detailTabs.related }] : []),
  ]);
</script>

<PageLayout trail={[{ label: messages.chrome.sections.grammar, href: urls.grammarIndexPath() }, { label: point.title, jp: true }]} section="grammar" wide {voice}>
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

  <!-- From 1024px the full page: Point, Examples, Related. -->
  <DetailTabs {tabs} label={messages.detailTabs.label} />

  <div class="grammar-body" data-detail-panels>
    <div id="point" class="detail-panel" data-default-panel>
      <section class="formation" aria-label="Formation">
        <h2 class="formation-label">Formation</h2>
        <p lang="ja">{point.formation}</p>
      </section>

      <p class="lead">{point.shortExplanation}</p>
      {#if hasLongExplanation}
        <!-- The full explanation in place, under the short one it expands. -->
        <details class="disclosure explanation">
          <summary>Read the full explanation</summary>
          <p>{point.longExplanation}</p>
        </details>
      {/if}

      <!-- After Formation, not after the header as on other pages: both are accent-edged boxes, and Formation is what a reader comes for. Its lead line sits between the two. -->
      <AppPanel link={appUrl({ placement: 'grammar' })} copy={messages.appPanel.grammar} />

      {#if point.usageNote}
        <section class="section">
          <h2>When to use</h2>
          <p>{point.usageNote}</p>
        </section>
      {/if}

      {#if exampleCount > 0}
        <!-- The tab's preview of Examples, curated first, then the corpus; the full page has Examples itself below, so not twice. -->
        <section class="section detail-preview">
          <div class="section-head">
            <h2>Examples</h2>
            {#if allExampleCount > POINT_EXAMPLES}<a href="#examples">{messages.grammar.allExamples(allExampleCount)} →</a>{/if}
          </div>
          <GrammarExamples examples={[...point.examples, ...minedExamples].slice(0, POINT_EXAMPLES)} idPrefix="preview-" {voice} />
        </section>
      {/if}
    </div>

    {#if exampleCount > 0}
      <section id="examples" class="section detail-panel" data-section-searchable>
        <div class="section-head">
          <h2>Examples</h2>
          <FuriganaToggle />
        </div>
        {#if point.examples.length > EXAMPLES_VISIBLE || minedExamples.length > 0}<SectionSearch label={messages.grammar.examplesSearch.label} placeholder={messages.grammar.examplesSearch.placeholder} />{/if}
        {#if point.examples.length > 0}<GrammarExamples examples={point.examples} idPrefix="example-" {voice} />{/if}
        {#if minedExamples.length > 0}
          <details class="disclosure">
            <summary>Corpus examples ({minedExamplesTotalCount.toLocaleString('en')})</summary>
            <GrammarExamples examples={minedExamples} idPrefix="corpus-" {voice} />
            {#if minedExamplesTotalCount > minedExamples.length}
              <p class="meta">Showing {minedExamples.length} of {minedExamplesTotalCount.toLocaleString('en')} corpus examples.</p>
            {/if}
          </details>
        {/if}
      </section>
    {/if}

    {#if hasRelated}
      <div id="related" class="section detail-panel">
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
      </div>
    {/if}
  </div>
</PageLayout>
