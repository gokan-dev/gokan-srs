<script lang="ts">
  import type { ErrorPageProps as Props } from '../lib/pageProps';
  import { grammarIndexPath, homePath, kanjiIndexPath, vocabIndexPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';

  let { status }: Props = $props();

  const missing = $derived(status === 404);
</script>

<!--
  A page rendered on request that cannot be shown: an id the dataset does not have (404), or a
  failure reading it (5xx). Kept out of search engines; the header's search still works.
-->
<PageLayout trail={[{ label: missing ? 'Page not found' : 'Page unavailable' }]}>
  <div class="page-intro">
    <h1>{missing ? 'Page not found' : 'Page unavailable'}</h1>
  </div>
  <p class="support">
    {missing
      ? 'There is no page at this address. The link may be mistyped, or the entry may have moved.'
      : 'This page could not be shown just now. Try again in a moment.'}
  </p>
  <p class="support">
    Browse the <a href={vocabIndexPath()}>vocabulary by JLPT level</a>, the <a href={kanjiIndexPath()}>kanji</a>
    or the <a href={grammarIndexPath()}>grammar points</a>, or go to the <a href={homePath()}>dictionary home</a>.
  </p>
</PageLayout>
