<script lang="ts">
  /** Numbered page links; the current page is marked, not linked away from. */
  interface Props {
    count: number;
    current: number;
    hrefOf: (page: number) => string;
    label: string;
    /** A link's text, when a bare number would not say what the page holds ("101-200"). */
    textOf?: (page: number) => string;
    /**
     * Words read before a link's text but not shown ("Steps " before "301-400"), when the text
     * alone would read wrong aloud. A prefix, never an aria-label: the spoken name keeps the
     * visible text, so voice control finds the link by what it shows (WCAG 2.5.3).
     */
    hiddenPrefixOf?: (page: number) => string;
  }

  let { count, current, hrefOf, label, textOf = String, hiddenPrefixOf }: Props = $props();
</script>

{#if count > 1}
  <nav class="pager" aria-label={label}>
    {#each Array.from({ length: count }, (_, i) => i + 1) as page (page)}
      <a href={hrefOf(page)} aria-current={page === current ? 'page' : undefined} >{#if hiddenPrefixOf}<span class="visually-hidden">{hiddenPrefixOf(page)}</span>{/if}{textOf(page)}</a>
    {/each}
  </nav>
{/if}
