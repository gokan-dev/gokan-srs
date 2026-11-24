<script lang="ts">
  import LinkedText from './LinkedText.svelte';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';

  const { urls, messages } = pageLocale();

  const noScript = $derived(messages.searchPage.noScript({
    vocab: urls.vocabIndexPath(),
    kanji: urls.kanjiIndexPath(),
    grammar: urls.grammarIndexPath(),
  }));
</script>

<!--
  Every match for ?q= as one list, best first across words, kanji and grammar points (the order
  gokan-srs's header search lists), drawn 50 rows at a time as it is scrolled: rendered by
  client/search.ts with the same query module as the header panel, over the index of the page's
  locale. The page itself is static, kept out of search engines.
-->
<PageLayout trail={[{ label: messages.chrome.crumbs.search }]} wide>
  <div class="page-intro">
    <h1 data-search-title>{messages.searchPage.heading}</h1>
  </div>

  <div data-search-page>
    <p class="support" data-search-nojs><LinkedText parts={noScript} /></p>
  </div>
</PageLayout>
