<script lang="ts">
  /**
   * A detail page section's search field, hidden until client/detailTabs.ts shows it: without the
   * script a section lists what it ships. Its label is hidden; its placeholder names the languages
   * the section's rows are searched in; the count line fills while it filters.
   */
  interface Props {
    label: string;
    placeholder: string;
  }

  let { label, placeholder }: Props = $props();
</script>

<div class="section-search" data-section-search hidden>
  <label><span class="visually-hidden">{label}</span><input class="search-input" type="search" {placeholder} autocomplete="off" spellcheck="false" /></label>
  <p class="meta" aria-live="polite" data-section-count></p>
</div>
