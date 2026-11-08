<script lang="ts">
  import type { LinkedText } from '../lib/messages';

  /** A catalog's sentence with links in it, in its own word order (the footer, the error page). */
  interface Props {
    parts: LinkedText;
  }

  let { parts }: Props = $props();
</script>

<!-- One line on purpose: the sentence's spacing is its catalog's, never the template's. -->
{#each parts as part, index (index)}{#if typeof part === 'string'}{part}{:else}<a href={part.href}>{part.text}</a>{/if}{/each}
