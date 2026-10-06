<script lang="ts">
  import type { ChapterIndexRow } from '../lib/grammarChapters';
  import { grammarChapterPath, grammarIndexPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';

  interface Props {
    /** Every chapter, already in teaching order. */
    chapters: ChapterIndexRow[];
  }

  let { chapters }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: 'Curriculum' }]}>

  <div class="hero">
    <h1>Japanese Grammar Curriculum</h1>
    <p>
      The full JLPT N5 to N1 teaching order, as {chapters.length} chapters of points meant to be
      learned together - not just an alphabetical or level-sorted list.
    </p>
  </div>

  <!--
    A flat numbered list rather than grouped by level: the point of this page is the ORDER
    chapters are taught in, which cuts across levels by design (a chapter can carry a harder
    register sibling of something it already teaches). Grouping by level would hide that.
  -->
  <ol class="chapter-list">
    {#each chapters as chapter (chapter.id)}
      <li class="chapter-row">
        <a class="chapter-row-link" href={grammarChapterPath(chapter.id)}>
          <span class="chapter-row-head">
            <span class="chapter-row-number">Chapter {chapter.chapterNumber}</span>
            <span class="badge">N{chapter.jlptLevel}</span>
          </span>
          <span class="chapter-row-title">{chapter.title}</span>
          <span class="chapter-row-summary">{chapter.summary}</span>
          <span class="chapter-row-count muted">{chapter.points.length} point{chapter.points.length === 1 ? '' : 's'}</span>
        </a>
      </li>
    {/each}
  </ol>
</PageLayout>
