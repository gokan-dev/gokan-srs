<script lang="ts">
  import type { GrammarChapterPageProps as Props } from '../lib/pageProps';
  import { langOf } from '../lib/documentShell';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';
  import Chip from './Chip.svelte';
  import GrammarList from './GrammarList.svelte';

  const { urls, messages } = pageLocale();

  let { chapter, totalChapters, previous, next }: Props = $props();
</script>

<PageLayout trail={[{ label: messages.chrome.sections.grammar, href: urls.grammarIndexPath() }, { label: messages.chrome.grammarTabs.curriculum, href: urls.grammarChaptersIndexPath() }, { label: `Chapter ${chapter.chapterNumber}` }]} section="grammar">
  <div class="page-intro">
    <h1 lang={langOf(chapter.title)}>{chapter.title}</h1>
    <p class="chips"><Chip label={`JLPT N${chapter.jlptLevel}`} /><span class="meta">Chapter {chapter.chapterNumber} of {totalChapters}</span></p>
    <p lang={langOf(chapter.summary)}>{chapter.summary}</p>
  </div>

  <section class="section">
    <h2>Points in this chapter <span class="meta">{chapter.points.length}</span></h2>
    <GrammarList points={chapter.points} showLevel />
  </section>

  <nav class="chapter-pager" aria-label="Chapters">
    {#if previous}
      <a href={urls.grammarChapterPath(previous.id)}><span class="meta">Previous chapter</span><span lang={langOf(previous.title)}>{previous.title}</span></a>
    {:else}
      <span></span>
    {/if}
    {#if next}
      <a class="chapter-pager-next" href={urls.grammarChapterPath(next.id)}><span class="meta">Next chapter</span><span lang={langOf(next.title)}>{next.title}</span></a>
    {/if}
  </nav>
</PageLayout>
