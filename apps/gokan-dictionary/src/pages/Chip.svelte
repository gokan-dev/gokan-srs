<script lang="ts">
  /**
   * A neutral metadata chip (JLPT level, register, "Common word"): never accent-coloured, since
   * accent means a link or an action. A chip with an href links to its listing, and shows that
   * with an accent border on hover and focus only.
   */
  interface Props {
    label: string;
    href?: string;
    /** The label's language, when it is not the page's (a textbook's English name on a Chinese page). */
    lang?: string;
  }

  let { label, href, lang }: Props = $props();
</script>

{#if href}<a class="chip" {href} {lang}>{label}</a>{:else}<span class="chip" {lang}>{label}</span>{/if}
