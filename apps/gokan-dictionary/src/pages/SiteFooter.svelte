<script lang="ts">
  import { appUrl } from '../lib/appLinks';
  import LinkedText from './LinkedText.svelte';
  import { pageLocale } from './pageLocale';

  import type { PageVoice } from '../lib/pageProps';

  /**
   * The voice's terms require its credit wherever its clips are used: on a page that plays them,
   * from index/audio.json (`credit`, `termsUrl`), never a copy. A page with none keeps its footer.
   */
  interface Props {
    voice?: PageVoice;
  }

  let { voice = null }: Props = $props();
  const { messages } = pageLocale();
</script>

<footer class="site-footer">
  <div class="container container--wide">
    <p><LinkedText parts={messages.chrome.footer({ dataset: 'https://github.com/gokan-dev/gokan-dataset', srs: appUrl({ placement: 'footer' }) })} /></p>
    {#if voice}<p><LinkedText parts={messages.chrome.voiceCredit({ text: voice.credit, href: voice.termsUrl })} /></p>{/if}
  </div>
</footer>
