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
  Every match for ?q=, grouped, 50 words a page: rendered by client/search.ts with the same query
  module as the header panel, over the index of the page's locale. The page itself is static, kept
  out of search engines.
-->
<PageLayout trail={[{ label: messages.chrome.crumbs.search }]} wide>
  <div class="page-intro">
    <h1 data-search-title>{messages.searchPage.heading}</h1>
  </div>

  <div data-search-page>
    <p class="support" data-search-nojs><LinkedText parts={noScript} /></p>
  </div>
</PageLayout>
