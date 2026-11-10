<script lang="ts">
  import { pageLocale } from './pageLocale';
  import type { Section } from '../lib/types';
  import SearchBox from './SearchBox.svelte';

  const { urls, messages, linkLang } = pageLocale();

  interface Props {
    section?: Section;
    /** The search field, on every page but the home page (whose hero is one). */
    search: boolean;
  }

  let { section, search }: Props = $props();

  const LINKS: { section: Section; label: string; href: string }[] = [
    { section: 'vocab', label: messages.chrome.sections.vocab, href: urls.vocabIndexPath() },
    { section: 'kanji', label: messages.chrome.sections.kanji, href: urls.kanjiIndexPath() },
    { section: 'grammar', label: messages.chrome.sections.grammar, href: urls.grammarIndexPath() },
  ];
</script>

<!--
  The search field lives in the shared header rather than only on the home page: looking a word
  up is the purpose of this site, so it should never cost a trip back home. The container is
  the wide measure on every page, so the header lines up with the entry pages.
-->
<header class="site-header">
  <div class="container container--wide site-header-inner">
    <a class="site-title" href={urls.homePath()}><span lang="ja">語感</span> <span class="site-title-word">{messages.chrome.siteTitleWord}</span></a>
    <nav class="site-nav" aria-label={messages.chrome.mainNav}>
      {#each LINKS as link (link.section)}
        <a href={link.href} hreflang={linkLang(link.href)} aria-current={link.section === section ? 'page' : undefined}>{link.label}{#if linkLang(link.href)}<span class="lang-mark">{messages.chrome.inEnglish}</span>{/if}</a>
      {/each}
    </nav>
    {#if search}<SearchBox />{/if}
  </div>
</header>
