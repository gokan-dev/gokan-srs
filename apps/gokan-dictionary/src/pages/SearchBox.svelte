<script lang="ts">
  import { searchPath } from '../lib/urls';

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

<form class="search" class:search--hero={hero} role="search" action={searchPath()} data-search>
  <label class="visually-hidden" for="search-input">Search the dictionary</label>
  <input
    id="search-input"
    class="search-input"
    type="search"
    name="q"
    placeholder="Search: kanji, kana, romaji or English"
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
    <div id="search-listbox" role="listbox" aria-label="Search results" data-search-results></div>
  </div>
</form>
