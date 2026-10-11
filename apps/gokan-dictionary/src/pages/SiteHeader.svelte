<script lang="ts">
  import { grammarIndexPath, homePath, kanjiIndexPath, vocabIndexPath } from '../lib/urls';
  import type { Section } from '../lib/types';
  import SearchBox from './SearchBox.svelte';

  interface Props {
    section?: Section;
    /** The search field, on every page but the home page (whose hero is one). */
    search: boolean;
  }

  let { section, search }: Props = $props();

  const LINKS: { section: Section; label: string; href: string }[] = [
    { section: 'vocab', label: 'Vocabulary', href: vocabIndexPath() },
    { section: 'kanji', label: 'Kanji', href: kanjiIndexPath() },
    { section: 'grammar', label: 'Grammar', href: grammarIndexPath() },
  ];
</script>

<!--
  The search field lives in the shared header rather than only on the home page: looking a word
  up is the purpose of this site, so it should never cost a trip back home. The container is
  the wide measure on every page, so the header lines up with the entry pages.
-->
<header class="site-header">
  <div class="container container--wide site-header-inner">
    <a class="site-title" href={homePath()}><span lang="ja">語感</span> Dictionary</a>
    <nav class="site-nav" aria-label="Main">
      {#each LINKS as link (link.section)}
        <a href={link.href} aria-current={link.section === section ? 'page' : undefined}>{link.label}</a>
      {/each}
    </nav>
    {#if search}<SearchBox />{/if}
  </div>
</header>
