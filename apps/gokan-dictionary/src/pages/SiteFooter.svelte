<script lang="ts">
  import { appUrl } from '../lib/appLinks';
  import LinkedText from './LinkedText.svelte';
  import { pageLocale } from './pageLocale';

  const { messages } = pageLocale();
</script>

<footer class="site-footer">
  <div class="container container--wide">
    <p><LinkedText parts={messages.chrome.footer({ dataset: 'https://github.com/gokan-dev/gokan-dataset', srs: appUrl({ placement: 'footer' }) })} /></p>
  </div>
</footer>
