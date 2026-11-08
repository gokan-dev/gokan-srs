<script lang="ts">
  import type { ErrorPageProps as Props } from '../lib/pageProps';
  import LinkedText from './LinkedText.svelte';
  import PageLayout from './PageLayout.svelte';
  import { pageLocale } from './pageLocale';

  const { urls, messages } = pageLocale();

  let { status }: Props = $props();

  const heading = $derived(messages.error.heading(status));
  const browse = $derived(messages.error.browse({
    vocab: urls.vocabIndexPath(),
    kanji: urls.kanjiIndexPath(),
    grammar: urls.grammarIndexPath(),
    home: urls.homePath(),
  }));
</script>

<!--
  A page rendered on request that cannot be shown: an id the dataset does not have (404), or a
  failure reading it (5xx). Kept out of search engines; the header's search still works.
-->
<PageLayout trail={[{ label: heading }]}>
  <div class="page-intro">
    <h1>{heading}</h1>
  </div>
  <p class="support">{messages.error.explanation(status)}</p>
  <p class="support"><LinkedText parts={browse} /></p>
</PageLayout>
