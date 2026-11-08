<script lang="ts">
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';

  const { urls, messages } = pageLocale();
</script>

<!--
  Every match for ?q=, grouped, 50 words a page: rendered by client/search.ts with the same query
  module as the header panel. The page itself is static, kept out of search engines.
-->
<PageLayout trail={[{ label: messages.chrome.crumbs.search }]} wide>
  <div class="page-intro">
    <h1 data-search-title>Search</h1>
  </div>

  <div data-search-page>
    <p class="support" data-search-nojs>
      Search needs JavaScript. You can still browse the <a href={urls.vocabIndexPath()}>vocabulary by JLPT level</a>,
      the <a href={urls.kanjiIndexPath()}>kanji</a> or the <a href={urls.grammarIndexPath()}>grammar points</a>.
    </p>
  </div>
</PageLayout>
