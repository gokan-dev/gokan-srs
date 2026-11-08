<script lang="ts">
  import type { GrammarFamiliesIndexPageProps as Props } from '../lib/pageProps';
  import { pageLocale } from './pageLocale';
  import PageLayout from './PageLayout.svelte';
  import GrammarTabs from './GrammarTabs.svelte';

  const { urls } = pageLocale();

  let { families }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: urls.grammarIndexPath() }, { label: 'Families' }]} section="grammar">
  <div class="page-intro">
    <h1>Grammar families</h1>
    <p>
      {families.length} groups of near-synonyms (<span lang="ja">でも</span>, <span lang="ja">しかし</span> and
      <span lang="ja">けれども</span>; <span lang="ja">から</span> and <span lang="ja">ので</span>), each with a page that
      compares its members.
    </p>
  </div>

  <GrammarTabs current="families" />

  <ul class="family-list">
    {#each families as family (family.id)}
      <li>
        <a class="family-list-name" href={urls.grammarFamilyPath(family.id)}>{family.name}</a>
        <span class="family-list-members">{#each family.members as member (member.id)}<a href={urls.grammarPath(member.id)} lang="ja">{member.title}</a>{/each}</span>
      </li>
    {/each}
  </ul>
</PageLayout>
