<script lang="ts">
  import type { ConjugationGroup } from '../lib/grammarConjugations';
  import { grammarIndexPath, grammarPath, homePath } from '../lib/urls';
  import SiteHeader from './SiteHeader.svelte';
  import SiteFooter from './SiteFooter.svelte';

  interface Props {
    groups: ConjugationGroup[];
    pointCount: number;
  }

  let { groups, pointCount }: Props = $props();
</script>

<SiteHeader />

<main>
  <div class="container">
    <p class="breadcrumb"><a href={homePath()}>Dictionary</a> / <a href={grammarIndexPath()}>Grammar</a> / Conjugations</p>

    <div class="hero">
      <h1>Japanese Conjugation Reference</h1>
      <p>
        {groups.length} conjugation forms across {pointCount} inflection pattern{pointCount === 1 ? '' : 's'} - the
        て-form, potential, causative, and more - each linking to a full table of example verbs
        and adjectives.
      </p>
    </div>

    <ul class="conjugation-form-list">
      {#each groups as group (group.formLabel)}
        <li class="card">
          <h2>{group.formLabel}</h2>
          <ul class="vocab-list">
            {#each group.points as point (point.id)}
              <li class="vocab-list-item">
                <a class="jp" href={grammarPath(point.id)}>{point.title}</a>
                <span class="muted">{point.itemCount} example{point.itemCount === 1 ? '' : 's'}</span>
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  </div>
</main>

<SiteFooter />
