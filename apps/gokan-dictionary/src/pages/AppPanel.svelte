<script lang="ts">
  import { APP_LINK_EVENT, type AppLink } from '../lib/appLinks';
  import type { PanelCopy } from '../lib/messages';
  import { pageLocale } from './pageLocale';
  import LinkedText from './LinkedText.svelte';

  /**
   * The one place a page presents the SRS app (#244): one sentence about what Gokan would do with
   * what the page is about, and one link into the app's setup. Once per page, after what the reader
   * came for: its header, or on a word page its Meanings (docs/DESIGN_SYSTEM.md). Static HTML: the
   * Umami script counts the click from its attributes.
   */
  interface Props {
    link: AppLink;
    copy: PanelCopy;
  }

  let { link, copy }: Props = $props();

  const { linkLang } = pageLocale();
</script>

<div class="app-panel">
  <p><LinkedText parts={copy.text} /></p>
  <a class="app-panel-action" href={link.href} hreflang={linkLang(link.href)} data-umami-event={APP_LINK_EVENT} data-umami-event-placement={link.placement}>{copy.action}</a>
</div>
