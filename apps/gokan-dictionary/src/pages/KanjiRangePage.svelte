<script lang="ts">
  import type { KanjiRangePageProps as Props } from '../lib/pageProps';
  import { WORDS_PER_KANJI, anyStepCapped } from '../lib/kanjiOrders';
  import { SITE_ORIGIN } from '../lib/site';
  import { kanjiRangeSlug, kanjiStepAnchor } from '../lib/urls';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';
  import Pager from './Pager.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  const { urls, messages } = pageLocale();

  let { order, range, steps, wordCount, ranges }: Props = $props();

  const current = $derived(ranges.findIndex(other => other.first === range.first) + 1);
  const rangeHref = (page: number) => urls.kanjiRangePath(order.id, ranges[page - 1]);
  const rangeText = (page: number) => kanjiRangeSlug(ranges[page - 1]);
  // Heard as "Steps 301-400", so the numbers say what they count.
  const rangePrefix = () => 'Steps ';
</script>

<PageLayout trail={[{ label: 'Kanji', href: urls.kanjiIndexPath() }, { label: 'Orders', href: urls.kanjiOrdersPath() }, { label: order.label, href: urls.kanjiOrderPath(order.id) }, { label: `${range.first} to ${range.last}` }]} section="kanji" wide>
  <div class="page-intro">
    <h1>{messages.kanjiRangeHeading(order, range)}</h1>
    <p>
      Steps {range.first} to {range.last} of {order.label} ({order.description}): {steps.length} kanji, in
      its order, and the {messages.count(wordCount, 'word')} you can read once you know them{#if wordCount > 1}, each
      under the kanji that completes it{/if}. {#if anyStepCapped(steps)}Each kanji shows its {WORDS_PER_KANJI} most frequent; its own
      page lists every word that uses it.{:else}Each kanji's own page lists every word that uses it.{/if}
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
        <h3><span class="range-step-number">{step}</span> <a href={urls.kanjiPath(character)} lang="ja">{character}</a></h3>
        {#if words.length > 0}
          <VocabEntryList entries={words} />
          {#if total > words.length}
            <p class="meta">{(total - words.length).toLocaleString('en')} more at this step: <a href={urls.kanjiPath(character)}>every word with <span lang="ja">{character}</span></a></p>
          {/if}
        {:else}
          <p class="meta">No word comes in at this step.</p>
        {/if}
      </div>
    {/each}
  </section>

  <!-- One pager, at the foot: at 320px a long order's ranges fill more than a screen, and the order page lists them too. -->
  <Pager count={ranges.length} current={current} hrefOf={rangeHref} textOf={rangeText} hiddenPrefixOf={rangePrefix} label="Steps" />

  <p class="support"><a href={SITE_ORIGIN + '/'}>Learn these words in Gokan</a>, in the order of your kanji book, with spaced repetition.</p>
</PageLayout>
