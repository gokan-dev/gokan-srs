<script lang="ts">
  import { langOf } from '../lib/documentShell';
  import type { FamilyPageData } from '../lib/grammarFamilies';
  import { grammarFamiliesIndexPath, grammarIndexPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';
  import GrammarList from './GrammarList.svelte';

  interface Props {
    family: FamilyPageData;
  }

  let { family }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: 'Families', href: grammarFamiliesIndexPath() }, { label: family.name }]} section="grammar">
  <div class="page-intro">
    <h1>{family.name}</h1>
    <p>
      {family.members.length} related grammar point{family.members.length === 1 ? '' : 's'} that express
      the same core idea{family.lessons.length > 0 ? ', compared below so you can tell which one to reach for.' : '. Each one\'s short explanation and level tell them apart.'}
    </p>
  </div>

  <!-- Each member with its explanation and level, so the page compares them even with no lessons. -->
  <section class="section">
    <h2>Members</h2>
    <GrammarList points={family.members} showLevel />
  </section>

  {#if family.interchangeable.length > 1}
    <section class="section">
      <h2>Interchangeable forms</h2>
      <p class="support">
        These are stylistic variants with no real difference in meaning or register: any one of
        them is correct, so there is no "which one" question to answer here.
      </p>
      <p class="family-interchangeable" lang="ja">{family.interchangeable.map(m => m.title).join('　/　')}</p>
    </section>
  {/if}

  {#each family.lessons as lesson (lesson.title)}
    <section class="section">
      <h2 lang={langOf(lesson.title)}>{lesson.title}</h2>
      {#each lesson.cases as case_, caseIndex (caseIndex)}
        <div class="family-case">
          <p class="family-case-situation">{case_.situation}</p>
          <p>
            <strong lang="ja">{case_.focus.title}</strong>
            vs
            <span lang="ja">{case_.vs.map(v => v.title).join('　/　')}</span>:
            {case_.guidance}
          </p>
        </div>
      {/each}
    </section>
  {/each}
</PageLayout>
