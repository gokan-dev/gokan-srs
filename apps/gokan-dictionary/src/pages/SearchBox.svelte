<script lang="ts">
  import { pageLocale } from './pageLocale';

  const { urls, messages } = pageLocale();

  /**
   * The search field, in the header or as the home page's hero. A plain form to /search/, so
   * Enter opens the results page even before (or without) the script; client/search.ts turns
   * it into a combobox over a grouped results panel. One per page, hence the fixed ids.
   */
  interface Props {
    hero?: boolean;
  }

  let { hero = false }: Props = $props();
</script>

<form class="search" class:search--hero={hero} role="search" action={urls.searchPath()} data-search>
  <label class="visually-hidden" for="search-input">{messages.chrome.search.label}</label>
  <input
    id="search-input"
    class="search-input"
    type="search"
    name="q"
    placeholder={messages.chrome.search.placeholder}
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
    enterkeyhint="search"
    role="combobox"
    aria-expanded="false"
    aria-controls="search-listbox"
    aria-autocomplete="list"
    data-search-input
  />
  <p class="visually-hidden" role="status" data-search-status></p>
  <div class="search-panel" data-search-panel hidden>
    <p class="search-message" data-search-message></p>
    <div id="search-listbox" role="listbox" aria-label={messages.chrome.search.results} data-search-results></div>
  </div>
</form>
