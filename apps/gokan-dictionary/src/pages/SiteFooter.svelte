<script lang="ts">
  import { SITE_ORIGIN } from '../lib/site';
  import LinkedText from './LinkedText.svelte';
  import { pageLocale } from './pageLocale';

  const { messages } = pageLocale();
</script>

<footer class="site-footer">
  <div class="container container--wide">
    <p><LinkedText parts={messages.chrome.footer({ dataset: 'https://github.com/gokan-dev/gokan-dataset', srs: SITE_ORIGIN + '/' })} /></p>
  </div>
</footer>
