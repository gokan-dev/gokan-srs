<script lang="ts">
  /** Numbered page links; the current page is marked, not linked away from. */
  interface Props {
    count: number;
    current: number;
    hrefOf: (page: number) => string;
    label: string;
  }

  let { count, current, hrefOf, label }: Props = $props();
</script>

{#if count > 1}
  <nav class="pager" aria-label={label}>
    {#each Array.from({ length: count }, (_, i) => i + 1) as page (page)}
      <a href={hrefOf(page)} aria-current={page === current ? 'page' : undefined}>{page}</a>
    {/each}
  </nav>
{/if}
