<script lang="ts">
  import { isKanjiOrderId, kanjiBookPositions, kanjiGradeLabel, kunReadingLabel } from '@gokan/dataset-schema';
  import type { Kanji, KanjiBook, KanjiOrderId } from '@gokan/dataset-schema';
  import type { VocabSummary } from '../lib/types';
  import { rangeOfStep } from '../lib/kanjiOrders';
  import { kanjiIndexPath, kanjiPath, kanjiRangePath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import Chip from './Chip.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  interface Props {
    kanji: Kanji;
    /** Every word containing the kanji, most frequent first. */
    words: VocabSummary[];
    /** Every kanji with a page, so a component that is one (子 in 学) links to it. */
    kanjiWithPages: ReadonlySet<string>;
    /** Each learning order's length: a book position links to its range page when the book is an order. */
    orderLengths: ReadonlyMap<KanjiOrderId, number>;
  }

  let { kanji, words, kanjiWithPages, orderLengths }: Props = $props();

  /** The range page listing the words this kanji's step unlocks; none for a book that is not an order (Essential Kanji). */
  function rangeHref(book: KanjiBook, position: number): string | undefined {
    if (!isKanjiOrderId(book)) return undefined;
    const length = orderLengths.get(book);
    return length === undefined ? undefined : kanjiRangePath(book, rangeOfStep(position, length));
  }

  const WORDS_VISIBLE = 30;
  const level = $derived(kanji.steps.jlpt);
  const kun = $derived(kanji.readings.kun.map(kunReadingLabel));
  const courses = $derived(kanjiBookPositions(kanji));
</script>

<PageLayout trail={[{ label: 'Kanji', href: kanjiIndexPath() }, { label: kanji.character, jp: true }]} section="kanji" wide>
  <header class="entry-head">
    <h1 class="kanji-glyph" lang="ja">{kanji.character}</h1>
    {#if kanji.meanings.length > 0}<p class="entry-gloss">{kanji.meanings.join(', ')}</p>{/if}

    {#if kanji.readings.on.length > 0 || kun.length > 0}
      <dl class="kanji-readings">
        {#if kanji.readings.on.length > 0}
          <div><dt>On</dt><dd lang="ja">{kanji.readings.on.join('、')}</dd></div>
        {/if}
        {#if kun.length > 0}
          <!-- The okurigana in parentheses: まな(ぶ) is read まなぶ, written 学ぶ. -->
          <div><dt>Kun</dt><dd lang="ja">{kun.join('、')}</dd></div>
        {/if}
      </dl>
    {/if}

    {#if level}<p class="chips"><Chip label={`JLPT N${level}`} href={`${kanjiIndexPath()}#n${level}`} /></p>{/if}
    <!-- The level is the chip's; the line names it only when there is no chip. -->
    <p class="meta">
      {#if !level}Outside the JLPT lists<span class="meta-sep" aria-hidden="true">·</span>{/if}{#if kanji.grade !== undefined}{kanjiGradeLabel(kanji.grade)}<span class="meta-sep" aria-hidden="true">·</span>{/if}{kanji.strokeCount} stroke{kanji.strokeCount === 1 ? '' : 's'}{#if kanji.radical}<span class="meta-sep" aria-hidden="true">·</span>Radical <span lang="ja">{kanji.radical.character}</span>{/if}
    </p>
  </header>

  {#if kanji.components.length > 0}
    <section class="section">
      <h2>Components</h2>
      <ul class="kanji-tiles">
        {#each kanji.components as component (component)}
          <li>
            {#if kanjiWithPages.has(component) && component !== kanji.character}
              <a href={kanjiPath(component)} lang="ja">{component}</a>
            {:else}
              <span lang="ja">{component}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="section">
    <h2>Words with <span lang="ja">{kanji.character}</span></h2>
    {#if words.length > 0}
      <VocabEntryList entries={words} visible={WORDS_VISIBLE} briefRest />
    {:else}
      <p class="support">No word in this dictionary uses this kanji yet.</p>
    {/if}
  </section>

  {#if courses.length > 0}
    <section class="section">
      <h2>In kanji courses</h2>
      <dl class="kanji-courses">
        {#each courses as { book, name, position } (book)}
          {@const href = rangeHref(book, position)}
          <div><dt>{name}</dt><dd>{#if href}<a {href}>#{position.toLocaleString('en')}</a>{:else}#{position.toLocaleString('en')}{/if}</dd></div>
        {/each}
      </dl>
    </section>
  {/if}

  {#if kanji.readings.nanori.length > 0}
    <details class="disclosure">
      <summary>Readings in names ({kanji.readings.nanori.length})</summary>
      <p lang="ja">{kanji.readings.nanori.join('、')}</p>
    </details>
  {/if}
</PageLayout>
