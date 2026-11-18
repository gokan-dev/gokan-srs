<script lang="ts">
  import type { KanjiPageProps as Props } from '../lib/pageProps';
  import { frequencyBand, isKanjiOrderId, kanjiBookPositions, kanjiGradeLabel, kunReadingLabel } from '@gokan/dataset-schema';
  import type { KanjiBook } from '@gokan/dataset-schema';
  import { rangeOfStep } from '../lib/kanjiOrders';
  import { pageLocale } from './pageLocale';
  import { appUrl } from '../lib/appLinks';
  import AppPanel from './AppPanel.svelte';
  import PageLayout from './PageLayout.svelte';
  import Chip from './Chip.svelte';
  import DetailTabs from './DetailTabs.svelte';
  import HowCommon from './HowCommon.svelte';
  import SectionSearch from './SectionSearch.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  const { urls, messages } = pageLocale();

  let { kanji, words, kanjiWithPages, orderLengths, orderStep }: Props = $props();

  /** This kanji's step on its range page, with the words it unlocks; none for a book that is not an order (Essential Kanji). */
  function rangeHref(book: KanjiBook, position: number): string | undefined {
    if (!isKanjiOrderId(book)) return undefined;
    const length = orderLengths.get(book);
    return length === undefined ? undefined : urls.kanjiStepPath(book, rangeOfStep(position, length), position);
  }

  /** The Words section's rows with their gloss; the rest, headword and reading only, in a disclosure (the 80 KB budget: 一 lists 660 words). */
  const WORDS_VISIBLE = 30;
  /** The Kanji tab's preview of Words, as the app's: the most common. */
  const COMMON_WORDS = 5;
  const level = $derived(kanji.steps.jlpt);
  const kun = $derived(kanji.readings.kun.map(kunReadingLabel));
  const courses = $derived(kanjiBookPositions(kanji));
  // The line under the heading speaks of linked steps, so it shows only when one is.
  const anyLinked = $derived(courses.some(({ book, position }) => rangeHref(book, position) !== undefined));
  const band = $derived(frequencyBand(kanji.newspaperFrequency, 'kanji'));
  const hasDetails = $derived(kanji.readings.nanori.length > 0 || kanji.radical !== undefined);

  /**
   * The sections, in the app kanji page's names and order (DetailTabs). Words has no catalog
   * label yet: the kanji pages are English only, as their headings are.
   */
  const tabs = $derived([
    { id: 'kanji', label: messages.vocab.tabs.kanji },
    ...(words.length > 0 ? [{ id: 'words', label: 'Words' }] : []),
  ]);
</script>

<!-- Each reading whole on its line, as the app's (KanjiReadings): a list breaks only after a 、, between readings. -->
{#snippet readingList(readings: string[])}{#each readings as reading, index (index)}{index > 0 ? '、' : ''}<span class="kanji-reading" data-kanji-reading>{reading}</span>{/each}{/snippet}

<PageLayout trail={[{ label: messages.chrome.sections.kanji, href: urls.kanjiIndexPath() }, { label: kanji.character, jp: true }]} section="kanji" wide>
  <header class="entry-head">
    <h1 class="kanji-glyph" lang="ja">{kanji.character}</h1>
    {#if kanji.meanings.length > 0}<p class="entry-gloss">{kanji.meanings.join(', ')}</p>{/if}

    {#if kanji.readings.on.length > 0 || kun.length > 0}
      <dl class="kanji-readings">
        {#if kanji.readings.on.length > 0}
          <div><dt>On</dt><dd lang="ja">{@render readingList(kanji.readings.on)}</dd></div>
        {/if}
        {#if kun.length > 0}
          <!-- The okurigana in parentheses: まな(ぶ) is read まなぶ, written 学ぶ. -->
          <div><dt>Kun</dt><dd lang="ja">{@render readingList(kun)}</dd></div>
        {/if}
      </dl>
    {/if}

    <p class="chips">{#if level}<Chip label={`JLPT N${level}`} href={`${urls.kanjiIndexPath()}#n${level}`} />{:else}<span class="meta">Outside the JLPT lists</span>{/if}</p>

    <!-- The facts row, as the app's header: how common in newspapers (on the kanji scale), school grade, strokes, radical. -->
    <dl class="entry-facts">
      <HowCommon label="How common" bars={band.bars} band={band.name} reference={band.reference} />
      {#if kanji.grade !== undefined}<div><dt>School grade</dt><dd>{kanjiGradeLabel(kanji.grade)}</dd></div>{/if}
      <div><dt>Strokes</dt><dd>{kanji.strokeCount}</dd></div>
      {#if kanji.radical}<div><dt>Radical</dt><dd lang="ja">{kanji.radical.character}</dd></div>{/if}
    </dl>
  </header>

  <!-- From 1024px the full page: Kanji, then Words. -->
  <DetailTabs {tabs} label={messages.vocab.tabs.label} />

  <div data-detail-panels>
    <div id="kanji" class="detail-panel" data-default-panel>
      <AppPanel
        link={appUrl({ placement: 'kanji', order: orderStep?.order.id, known: orderStep?.step })}
        copy={orderStep ? messages.appPanel.kanji(kanji.character, orderStep, orderStep.unlocked) : messages.appPanel.general}
      />

      {#if kanji.components.length > 0}
        <section class="section">
          <h2>Components</h2>
          <ul class="kanji-tiles">
            {#each kanji.components as component (component)}
              <li>
                {#if kanjiWithPages.has(component) && component !== kanji.character}
                  <a href={urls.kanjiPath(component)} lang="ja">{component}</a>
                {:else}
                  <span lang="ja">{component}</span>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if words.length > 0}
        <!-- The tab's preview of Words; the full page has Words itself below, so not twice. -->
        <section class="section detail-preview">
          <div class="section-head">
            <h2>Common words</h2>
            {#if words.length > COMMON_WORDS}<a href="#words">All {words.length.toLocaleString('en')} words →</a>{/if}
          </div>
          <VocabEntryList entries={words.slice(0, COMMON_WORDS)} />
        </section>
      {:else}
        <!-- No Words tab to point to: said here, so no words reads as a fact, not a list that failed to show. -->
        <p class="support">No word in this dictionary uses this kanji yet.</p>
      {/if}

      {#if courses.length > 0}
        <section class="section">
          <h2>In kanji courses</h2>
          {#if anyLinked}<p class="support">A linked step leads to the words you can read at that point in the book.</p>{/if}
          <dl class="kanji-courses">
            {#each courses as { book, name, label, position } (book)}
              {@const href = rangeHref(book, position)}
              <!-- Named as the order pages its link lands on name it, the full title under it (heard after a comma). -->
              <div><dt>{#if label}{label}<span class="kanji-course-title"><span class="visually-hidden">, </span>{name}</span>{:else}{name}{/if}</dt><dd>{#if href}<a {href}>Step {position.toLocaleString('en')}<span class="visually-hidden">: the words you can read at this step</span></a>{:else}Step {position.toLocaleString('en')}{/if}</dd></div>
            {/each}
          </dl>
        </section>
      {/if}

      {#if hasDetails}
        <!-- What a reader rarely looks a kanji up for, folded at the Kanji section's foot, as the app's Details. -->
        <details class="disclosure kanji-details">
          <summary>Details</summary>
          <dl>
            {#if kanji.readings.nanori.length > 0}<div><dt>Readings in names</dt><dd lang="ja">{kanji.readings.nanori.join('、')}</dd></div>{/if}
            {#if kanji.radical}<div><dt>Kangxi radical</dt><dd>No. {kanji.radical.number}</dd></div>{/if}
          </dl>
        </details>
      {/if}
    </div>

    {#if words.length > 0}
      <section id="words" class="section detail-panel" data-section-searchable>
        <h2>Words with <span lang="ja">{kanji.character}</span></h2>
        {#if words.length > WORDS_VISIBLE}<SectionSearch label="Search the words" placeholder="Search in English or Japanese" />{/if}
        <VocabEntryList entries={words} visible={WORDS_VISIBLE} briefRest />
      </section>
    {/if}
  </div>
</PageLayout>
