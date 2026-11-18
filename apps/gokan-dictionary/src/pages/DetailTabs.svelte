<script lang="ts">
  /**
   * A detail page's row of tabs: a word's, a kanji's, a grammar point's. Below 1024px a row of
   * tabs, one section at a time (client/detailTabs.ts, which reads `data-detail-tabs` and each
   * link's `data-tab`; until it runs, and with no script at all, the hash's section by CSS, or the
   * whole page without a class the head sets). From 1024px the full page. Each tab's id is the URL
   * hash the app uses for its section, the first section's none. With one section there is
   * nothing to switch between, so no row.
   */
  interface Props {
    tabs: { id: string; label: string }[];
    /** The row's accessible name, from the catalog. */
    label: string;
  }

  let { tabs, label }: Props = $props();
</script>

{#if tabs.length > 1}
  <nav class="detail-tabs" data-detail-tabs aria-label={label}>
    {#each tabs as tab (tab.id)}<a href="#{tab.id}" data-tab={tab.id}>{tab.label}</a>{/each}
  </nav>
{/if}
