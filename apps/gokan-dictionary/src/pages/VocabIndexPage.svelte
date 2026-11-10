<script lang="ts">
  import type { VocabIndexPageProps as Props } from '../lib/pageProps';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';

  const { urls, messages } = pageLocale();

  let { levels, totalCount }: Props = $props();
</script>

<PageLayout trail={[{ label: messages.chrome.sections.vocab }]} section="vocab" wide>
  <div class="page-intro">
    <h1>{messages.chrome.sections.vocab}</h1>
    <p>{messages.vocabIndex.intro(totalCount)}</p>
  </div>

  <!--
    One list per JLPT level: only about 6,400 of the ~36,000 entries carry a level. The others are
    reachable through search, the kanji pages that contain them, and the example sentences.
  -->
  <ul class="tiles" style={`--tiles: ${levels.length}`}>
    {#each levels as { level, count } (level)}
      <li>
        <a class="tile" href={urls.vocabJlptPath(level)}>
          <span class="tile-title">{messages.vocabIndex.levelTitle(level)}</span>
          <span class="tile-meta">{messages.count(count, 'word')}</span>
          <span class="tile-blurb">{messages.vocabIndex.levelBlurbs[level]}</span>
        </a>
      </li>
    {/each}
  </ul>
</PageLayout>
