<script lang="ts">
  /** Numbered page links; the current page is marked, not linked away from. */
  interface Props {
    count: number;
    current: number;
    hrefOf: (page: number) => string;
    label: string;
    /** A link's text, when a bare number would not say what the page holds ("101-200"). */
    textOf?: (page: number) => string;
  }

  let { count, current, hrefOf, label, textOf = String }: Props = $props();
</script>

{#if count > 1}
  <nav class="pager" aria-label={label}>
    {#each Array.from({ length: count }, (_, i) => i + 1) as page (page)}
      <a href={hrefOf(page)} aria-current={page === current ? 'page' : undefined}>{textOf(page)}</a>
    {/each}
  </nav>
{/if}
