<script lang="ts">
  import type { KanjiOrdersPageProps as Props } from '../lib/pageProps';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';

  const { urls, messages } = pageLocale();

  let { orders }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Kanji', href: urls.kanjiIndexPath() }, { label: 'Orders' }]} section="kanji" wide>
  <div class="page-intro">
    <h1>Vocabulary by kanji learning order</h1>
    <p>
      Every kanji book teaches the characters in its own order, and the JLPT and frequency orders are
      here too. Pick yours to see the words you can read at each step: a word comes in at the step of its last kanji, once you know every kanji in it.
    </p>
  </div>

  <ul class="tiles">
    {#each orders as { order, kanjiCount, wordCount } (order.id)}
      <li>
        <a class="tile" href={urls.kanjiOrderPath(order.id)}>
          <span class="tile-title">{order.label}</span>
          <span class="tile-meta">{kanjiCount.toLocaleString('en')} kanji · {messages.count(wordCount, 'word')}</span>
          <span class="tile-blurb">{order.description}</span>
        </a>
      </li>
    {/each}
  </ul>
</PageLayout>
