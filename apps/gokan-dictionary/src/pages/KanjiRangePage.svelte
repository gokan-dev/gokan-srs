<script lang="ts">
  import type { KanjiOrder } from '@gokan/dataset-schema';
  import { countLabel } from '../lib/counts';
  import { WORDS_PER_KANJI, type StepRange } from '../lib/kanjiOrders';
  import { kanjiRangeHeading } from '../lib/seo';
  import type { VocabSummary } from '../lib/types';
  import { SITE_ORIGIN } from '../lib/site';
  import { kanjiIndexPath, kanjiOrderPath, kanjiOrdersPath, kanjiPath, kanjiRangePath, kanjiRangeSlug, kanjiStepAnchor } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import Pager from './Pager.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  interface Props {
    order: KanjiOrder;
    range: StepRange;
    /** Each step of the range: its kanji, the head of the words it unlocks, and how many it unlocks. */
    steps: { step: number; character: string; words: VocabSummary[]; total: number }[];
    /** Every word the range unlocks, listed or not. */
    wordCount: number;
    /** Every range of the order, for the pager. */
    ranges: StepRange[];
  }

  let { order, range, steps, wordCount, ranges }: Props = $props();

  const current = $derived(ranges.findIndex(other => other.first === range.first) + 1);
  const rangeHref = (page: number) => kanjiRangePath(order.id, ranges[page - 1]);
  const rangeText = (page: number) => kanjiRangeSlug(ranges[page - 1]);
  // Said in words: a screen reader reads "301-400" as "301 minus 400".
  const rangeLabel = (page: number) => `Steps ${ranges[page - 1].first} to ${ranges[page - 1].last}`;
</script>

<PageLayout trail={[{ label: 'Kanji', href: kanjiIndexPath() }, { label: 'Orders', href: kanjiOrdersPath() }, { label: order.label, href: kanjiOrderPath(order.id) }, { label: `${range.first} to ${range.last}` }]} section="kanji" wide>
  <div class="page-intro">
    <h1>{kanjiRangeHeading(order, range)}</h1>
    <p>
      Steps {range.first} to {range.last} of {order.label} ({order.description}): {steps.length} kanji, in
      its order, and the {countLabel(wordCount, 'word')} you can read once you know them, each
      under the kanji that completes it. Each kanji shows its {WORDS_PER_KANJI} most frequent; its own
      page lists every word that uses it.
    </p>
  </div>

  <section class="section">
    <h2>Kanji</h2>
    <!-- An index of the page: each tile leads to its step below, whose heading links to the kanji. -->
    <ul class="kanji-tiles">
      {#each steps as { step, character } (step)}
        <li><a href={`#${kanjiStepAnchor(step)}`} lang="ja">{character}</a></li>
      {/each}
    </ul>
  </section>

  <section class="section">
    <h2>Words by step</h2>
    {#each steps as { step, character, words, total } (step)}
      <div class="range-step" id={kanjiStepAnchor(step)}>
        <h3><span class="range-step-number">{step}</span> <a href={kanjiPath(character)} lang="ja">{character}</a></h3>
        {#if words.length > 0}
          <VocabEntryList entries={words} />
          {#if total > words.length}
            <p class="meta">{(total - words.length).toLocaleString('en')} more at this step: <a href={kanjiPath(character)}>every word with <span lang="ja">{character}</span></a></p>
          {/if}
        {:else}
          <p class="meta">No word comes in at this step.</p>
        {/if}
      </div>
    {/each}
  </section>

  <!-- One pager, at the foot: at 320px a long order's ranges fill more than a screen, and the order page lists them too. -->
  <Pager count={ranges.length} current={current} hrefOf={rangeHref} textOf={rangeText} labelOf={rangeLabel} label="Steps" />

  <p class="support"><a href={SITE_ORIGIN + '/'}>Learn these words in Gokan</a>, in the order of your kanji book, with spaced repetition.</p>
</PageLayout>
