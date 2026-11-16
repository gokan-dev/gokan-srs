<script lang="ts">
  import { renderedRuns } from '../lib/linkedText';
  import type { LinkedText } from '../lib/messages';
  import { pageLocale } from './pageLocale';

  /**
   * A catalog's sentence in its own word order (the footer, the error page, the app panel): its
   * links, a link into the app counted, and its runs in another language marked (lib/linkedText.ts).
   */
  interface Props {
    parts: LinkedText;
  }

  let { parts }: Props = $props();

  // A link leaving a page's section says where it leads (lib/localeLinks.ts); the catalog's words say it to a reader.
  const { linkLang } = pageLocale();
  const runs = $derived(renderedRuns(parts, linkLang));
</script>

<!-- One line on purpose: the sentence's spacing is its catalog's, never the template's. -->
{#each runs as part, index (index)}{#if typeof part === 'string'}{part}{:else if part.href !== undefined}<a href={part.href} lang={part.lang} hreflang={part.hreflang} data-umami-event={part.event} data-umami-event-placement={part.placement}>{part.text}</a>{:else}<span lang={part.lang}>{part.text}</span>{/if}{/each}
