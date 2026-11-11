<script lang="ts">
  import type { HomePageProps as Props } from '../lib/pageProps';
  import { pageLocale } from './pageLocale';
  import { SITE_ORIGIN } from '../lib/site';
  import LinkedText from './LinkedText.svelte';
  import PageLayout from './PageLayout.svelte';
  import SearchBox from './SearchBox.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  const { urls, messages, linkLang } = pageLocale();
  const home = messages.home;

  let { vocabCount, kanjiCount, grammarCount, sentenceCount, featured }: Props = $props();

  const tiles = $derived([
    { href: urls.vocabIndexPath(), ...home.tiles.vocab },
    { href: urls.kanjiIndexPath(), ...home.tiles.kanji(kanjiCount) },
    { href: urls.kanjiOrdersPath(), ...home.tiles.kanjiOrders },
    { href: urls.grammarIndexPath(), ...home.tiles.grammar(grammarCount) },
  ]);
</script>

<!-- The hero is the search field, so the header leaves its own out: one search field on screen. -->
<PageLayout headerSearch={false}>
  <div class="home-hero">
    <h1>{home.heading}</h1>
    <p class="home-lede">{home.lede}</p>
    <SearchBox hero />
  </div>

  <section class="section">
    <h2>{home.browse}</h2>
    <ul class="tiles" style="--tiles: 2">
      {#each tiles as tile (tile.href)}
        <li>
          <a class="tile" href={tile.href} hreflang={linkLang(tile.href)}>
            <span class="tile-title">{tile.title}</span>
            <span class="tile-meta">{tile.meta}</span>
            <span class="tile-blurb">{tile.blurb}</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  {#if featured.length > 0}
    <section class="section">
      <h2>{home.commonWords}</h2>
      <VocabEntryList entries={featured} />
    </section>
  {/if}

  <p class="meta home-counts">{home.counts({ words: vocabCount, kanji: kanjiCount, grammar: grammarCount, sentences: sentenceCount })}</p>

  <section class="section">
    <h2>{home.about}</h2>
    <p><LinkedText parts={home.aboutText({ dataset: 'https://github.com/gokan-dev/gokan-dataset', srs: SITE_ORIGIN + '/' })} /></p>
  </section>
</PageLayout>
