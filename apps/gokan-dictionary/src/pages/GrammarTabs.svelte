<script lang="ts">
  import type { GrammarTab } from '../lib/types';
  import { pageLocale } from './pageLocale';

  const { urls, messages } = pageLocale();
  const tabs = messages.chrome.grammarTabs;

  interface Props {
    current: GrammarTab;
  }

  let { current }: Props = $props();

  const TABS: { tab: GrammarTab; label: string; href: string }[] = [
    { tab: 'level', label: tabs.level, href: urls.grammarIndexPath() },
    { tab: 'families', label: tabs.families, href: urls.grammarFamiliesIndexPath() },
    { tab: 'curriculum', label: tabs.curriculum, href: urls.grammarChaptersIndexPath() },
    { tab: 'conjugations', label: tabs.conjugations, href: urls.grammarConjugationsIndexPath() },
  ];
</script>

<nav class="tabs" aria-label={tabs.label}>
  {#each TABS as tab (tab.tab)}
    <a href={tab.href} aria-current={tab.tab === current ? 'page' : undefined}>{tab.label}</a>
  {/each}
</nav>
