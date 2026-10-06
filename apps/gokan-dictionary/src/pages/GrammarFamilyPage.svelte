<script lang="ts">
  import type { FamilyPageData } from '../lib/grammarFamilies';
  import { grammarIndexPath, grammarPath } from '../lib/urls';
  import PageLayout from './PageLayout.svelte';

  interface Props {
    family: FamilyPageData;
  }

  let { family }: Props = $props();
</script>

<PageLayout trail={[{ label: 'Grammar', href: grammarIndexPath() }, { label: family.name }]}>

  <h1>{family.name}</h1>
  <p>
    {family.members.length} related grammar point{family.members.length === 1 ? '' : 's'} that express
    the same core idea{family.lessons.length > 0 ? ' - compared below so you can tell which one to reach for.' : '.'}
  </p>

  <section class="card">
    <h2>Members</h2>
    <ul class="vocab-list">
      {#each family.members as member (member.id)}
        <li class="vocab-list-item">
          <a class="jp" href={grammarPath(member.id)}>{member.title}</a>
          <span class="muted">JLPT N{member.jlptLevel}</span>
        </li>
      {/each}
    </ul>
  </section>

  {#if family.interchangeable.length > 1}
    <section class="card">
      <h2>Interchangeable forms</h2>
      <p class="muted">
        These are stylistic variants with no real difference in meaning or register - any one of
        them is correct, so there is no "which one" question to answer here.
      </p>
      <p class="jp family-interchangeable-list">
        {family.interchangeable.map(m => m.title).join('　/　')}
      </p>
    </section>
  {/if}

  {#each family.lessons as lesson (lesson.title)}
    <section class="card">
      <h2>{lesson.title}</h2>
      {#each lesson.cases as case_, caseIndex (caseIndex)}
        <div class="family-case">
          <p class="family-case-situation">{case_.situation}</p>
          <p class="family-case-guidance">
            <strong class="jp">{case_.focus.title}</strong>
            vs
            <span class="jp">{case_.vs.map(v => v.title).join('　/　')}</span>:
            {case_.guidance}
          </p>
        </div>
      {/each}
    </section>
  {/each}
</PageLayout>
