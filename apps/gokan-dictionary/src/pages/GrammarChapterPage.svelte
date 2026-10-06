<script lang="ts">
  import type { ChapterIndexRow } from '../lib/grammarChapters';
  import { grammarChapterPath, grammarChaptersIndexPath, grammarIndexPath, grammarPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';

  interface Props {
    chapter: ChapterIndexRow;
    totalChapters: number;
    /** Adjacent chapters in teaching order, for prev/next navigation. Null at either end. */
    previous: { id: string; title: string } | null;
    next: { id: string; title: string } | null;
  }

  let { chapter, totalChapters, previous, next }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: 'Curriculum', href: grammarChaptersIndexPath() }, { label: `Chapter ${chapter.chapterNumber}` }]}>

  <h1>
    {chapter.title}
    <span class="badge">JLPT N{chapter.jlptLevel}</span>
  </h1>
  <p class="muted">Chapter {chapter.chapterNumber} of {totalChapters}</p>
  <p>{chapter.summary}</p>

  <section class="card">
    <h2>Points in this chapter <span class="muted">({chapter.points.length})</span></h2>
    <ul class="vocab-list">
      {#each chapter.points as point (point.id)}
        <li class="vocab-list-item">
          <a class="jp" href={grammarPath(point.id)}>{point.title}</a>
          <span class="muted">JLPT N{point.jlptLevel}</span>
        </li>
      {/each}
    </ul>
  </section>

  <nav class="chapter-pager">
    {#if previous}
      <a class="chapter-pager-link" href={grammarChapterPath(previous.id)}>&larr; <span class="jp">{previous.title}</span></a>
    {:else}
      <span></span>
    {/if}
    {#if next}
      <a class="chapter-pager-link chapter-pager-link--next" href={grammarChapterPath(next.id)}><span class="jp">{next.title}</span> &rarr;</a>
    {/if}
  </nav>
</PageLayout>
