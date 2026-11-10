<script lang="ts">
  import { pageLocale } from './pageLocale';

  const { messages } = pageLocale();
</script>

<!--
  Hides or shows the furigana of every sentence on the page, remembered across pages
  (client/search.ts wires it and unhides it: without the script there is nothing to toggle, so
  the button stays hidden and the furigana shown).
-->
<button class="button" type="button" data-furigana-toggle data-show-label={messages.chrome.showFurigana} hidden>{messages.chrome.hideFurigana}</button>
