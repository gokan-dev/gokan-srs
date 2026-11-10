<script lang="ts">
  import type { LinkedText } from '../lib/messages';
  import { pageLocale } from './pageLocale';

  /** A catalog's sentence with links in it, in its own word order (the footer, the error page). */
  interface Props {
    parts: LinkedText;
  }

  let { parts }: Props = $props();

  // A link leaving a page's section says where it leads (lib/localeLinks.ts); the catalog's words say it to a reader.
  const { linkLang } = pageLocale();
  const runs = $derived(parts.map(part => (typeof part === 'string' ? part : { ...part, hreflang: linkLang(part.href) })));
</script>

<!-- One line on purpose: the sentence's spacing is its catalog's, never the template's. -->
{#each runs as part, index (index)}{#if typeof part === 'string'}{part}{:else}<a href={part.href} hreflang={part.hreflang}>{part.text}</a>{/if}{/each}
