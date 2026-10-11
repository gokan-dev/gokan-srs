<script lang="ts">
  /**
   * A neutral metadata chip (JLPT level, register, "Common word"): never accent-coloured, since
   * accent means a link or an action. A chip with an href links to its listing, and shows that
   * with an accent border on hover and focus only.
   */
  interface Props {
    label: string;
    href?: string;
  }

  let { label, href }: Props = $props();
</script>

{#if href}<a class="chip" {href}>{label}</a>{:else}<span class="chip">{label}</span>{/if}
