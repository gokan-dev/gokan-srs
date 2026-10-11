<script lang="ts">
  import type { ChapterIndexRow } from '../lib/grammarChapters';
  import { grammarChapterPath, grammarChaptersIndexPath, grammarIndexPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import Chip from './Chip.svelte';
  import GrammarList from './GrammarList.svelte';

  interface Props {
    chapter: ChapterIndexRow;
    totalChapters: number;
    /** Adjacent chapters in teaching order, for prev/next navigation. Null at either end. */
    previous: { id: string; title: string } | null;
    next: { id: string; title: string } | null;
  }

  let { chapter, totalChapters, previous, next }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: 'Curriculum', href: grammarChaptersIndexPath() }, { label: `Chapter ${chapter.chapterNumber}` }]} section="grammar">
  <div class="page-intro">
    <h1>{chapter.title}</h1>
    <p class="chips"><Chip label={`JLPT N${chapter.jlptLevel}`} /><span class="meta">Chapter {chapter.chapterNumber} of {totalChapters}</span></p>
    <p>{chapter.summary}</p>
  </div>

  <section class="section">
    <h2>Points in this chapter <span class="meta">{chapter.points.length}</span></h2>
    <GrammarList points={chapter.points} showLevel />
  </section>

  <nav class="chapter-pager" aria-label="Chapters">
    {#if previous}
      <a href={grammarChapterPath(previous.id)}><span class="meta">Previous chapter</span>{previous.title}</a>
    {:else}
      <span></span>
    {/if}
    {#if next}
      <a class="chapter-pager-next" href={grammarChapterPath(next.id)}><span class="meta">Next chapter</span>{next.title}</a>
    {/if}
  </nav>
</PageLayout>
