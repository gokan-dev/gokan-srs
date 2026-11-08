<script lang="ts">
  import type { GrammarChaptersIndexPageProps as Props } from '../lib/pageProps';
  import { langOf } from '../lib/documentShell';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';
  import GrammarTabs from './GrammarTabs.svelte';

  const { urls } = pageLocale();

  let { groups, chapterCount }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: urls.grammarIndexPath() }, { label: 'Curriculum' }]} section="grammar">
  <div class="page-intro">
    <h1>Grammar curriculum</h1>
    <p>
      The JLPT N5 to N1 teaching order as {chapterCount} chapters of points meant to be learned
      together. A chapter can carry a harder register sibling of something it teaches.
    </p>
  </div>

  <GrammarTabs current="curriculum" />

  {#each groups as group (group.level)}
    <section class="section">
      <h2>JLPT N{group.level}</h2>
      <ol class="chapter-list">
        {#each group.items as chapter (chapter.id)}
          <li>
            <a href={urls.grammarChapterPath(chapter.id)}>
              <span class="meta">Chapter {chapter.chapterNumber} · {chapter.points.length} point{chapter.points.length === 1 ? '' : 's'}</span>
              <span class="chapter-list-title" lang={langOf(chapter.title)}>{chapter.title}</span>
              <span class="support" lang={langOf(chapter.summary)}>{chapter.summary}</span>
            </a>
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</PageLayout>
