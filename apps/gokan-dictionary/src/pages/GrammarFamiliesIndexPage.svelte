<script lang="ts">
  import type { FamilyPageData } from '../lib/grammarFamilies';
  import { grammarFamilyPath, grammarIndexPath, grammarPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import GrammarTabs from './GrammarTabs.svelte';

  interface Props {
    /** Largest first: the clusters a learner most needs told apart. */
    families: FamilyPageData[];
  }

  let { families }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: 'Families' }]} section="grammar">
  <div class="page-intro">
    <h1>Grammar families</h1>
    <p>
      {families.length} groups of near-synonyms (でも, しかし and けれども; から and ので), each
      with a page that compares its members.
    </p>
  </div>

  <GrammarTabs current="families" />

  <ul class="family-list">
    {#each families as family (family.id)}
      <li>
        <a class="family-list-name" href={grammarFamilyPath(family.id)}>{family.name}</a>
        <span class="family-list-members">{#each family.members as member (member.id)}<a href={grammarPath(member.id)} lang="ja">{member.title}</a>{/each}</span>
      </li>
    {/each}
  </ul>
</PageLayout>
