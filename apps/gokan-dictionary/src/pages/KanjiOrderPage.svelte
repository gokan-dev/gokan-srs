<script lang="ts">
  import type { KanjiOrder } from '@gokan/dataset-schema';
  import { countLabel } from '../lib/counts';
  import type { KanjiRange } from '../lib/kanjiOrders';
  import { kanjiIndexPath, kanjiOrdersPath, kanjiRangePath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';

  interface Props {
    order: KanjiOrder;
    ranges: KanjiRange[];
    kanjiCount: number;
    wordCount: number;
  }

  let { order, ranges, kanjiCount, wordCount }: Props = $props();

  /** The first kanji of a range, so a learner finds where they are by sight. */
  const PREVIEW = 10;
</script>

<PageLayout trail={[{ label: 'Kanji', href: kanjiIndexPath() }, { label: 'Orders', href: kanjiOrdersPath() }, { label: order.label }]} section="kanji" wide>
  <div class="page-intro">
    <h1>{order.searchName} vocabulary by kanji step</h1>
    <p>
      {order.label} ({order.description}) has {kanjiCount.toLocaleString('en')} kanji; step 1 is its first. A word
      comes in at the step of its last kanji, once you know every kanji in it, so each range below
      lists the words you can read on reaching it: {countLabel(wordCount, 'word')} in all. Words
      usually written in kana, and words with a kanji this order does not teach, are not listed.
    </p>
  </div>

  <ul class="range-list">
    {#each ranges as range (range.first)}
      <li>
        <a href={kanjiRangePath(order.id, range)}>
          <span class="range-title">Steps {range.first} to {range.last}</span>
          <span class="range-preview" lang="ja">{range.steps.slice(0, PREVIEW).map(step => step.character).join('')}</span>
          <span class="meta">{range.steps.length} kanji · {countLabel(range.wordCount, 'word')}</span>
        </a>
      </li>
    {/each}
  </ul>
</PageLayout>
