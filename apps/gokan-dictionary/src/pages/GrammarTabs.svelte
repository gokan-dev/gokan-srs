<script module lang="ts">
  /** The grammar browse pages' shared tabs. */
  export type GrammarTab = 'level' | 'families' | 'curriculum' | 'conjugations';
</script>

<script lang="ts">
  import { grammarChaptersIndexPath, grammarConjugationsIndexPath, grammarFamiliesIndexPath, grammarIndexPath } from '../lib/urls';

  interface Props {
    current: GrammarTab;
  }

  let { current }: Props = $props();

  const TABS: { tab: GrammarTab; label: string; href: string }[] = [
    { tab: 'level', label: 'By level', href: grammarIndexPath() },
    { tab: 'families', label: 'Families', href: grammarFamiliesIndexPath() },
    { tab: 'curriculum', label: 'Curriculum', href: grammarChaptersIndexPath() },
    { tab: 'conjugations', label: 'Conjugations', href: grammarConjugationsIndexPath() },
  ];
</script>

<nav class="tabs" aria-label="Browse grammar">
  {#each TABS as tab (tab.tab)}
    <a href={tab.href} aria-current={tab.tab === current ? 'page' : undefined}>{tab.label}</a>
  {/each}
</nav>
