<script lang="ts">
  import type { VocabJlptPageProps as Props } from '../lib/pageProps';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';
  import Pager from './Pager.svelte';
  import VocabEntryList from './VocabEntryList.svelte';

  const { urls, messages } = pageLocale();
  const jlpt = messages.vocabJlpt;

  let { level, words, total, page, pageCount, firstRank, allLevels }: Props = $props();
</script>

<PageLayout trail={[{ label: messages.chrome.sections.vocab, href: urls.vocabIndexPath() }, { label: messages.jlptLabel(level), href: page > 1 ? urls.vocabJlptPath(level) : undefined }, ...(page > 1 ? [{ label: jlpt.pageCrumb(page) }] : [])]} section="vocab" wide>
  <div class="page-intro">
    <h1>{jlpt.heading(level, page)}</h1>
    <p>
      {jlpt.intro(total)}
      {#if pageCount > 1}{jlpt.range(firstRank, firstRank + words.length - 1)}{/if}
    </p>
  </div>

  <Pager count={pageCount} current={page} hrefOf={(p: number) => urls.vocabJlptPath(level, p)} label={messages.chrome.pages} />

  <VocabEntryList entries={words} />

  <Pager count={pageCount} current={page} hrefOf={(p: number) => urls.vocabJlptPath(level, p)} label={messages.chrome.pages} />

  <nav class="level-nav" aria-label={jlpt.otherLevels}>
    <span class="meta">{jlpt.otherLevelsLead}</span>
    {#each allLevels.filter(other => other !== level) as other (other)}
      <a href={urls.vocabJlptPath(other)}>{messages.jlptLevel(other)}</a>
    {/each}
  </nav>
</PageLayout>
