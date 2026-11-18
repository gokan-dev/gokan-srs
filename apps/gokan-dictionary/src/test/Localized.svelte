<script lang="ts" generics="P extends object">
  import type { Component } from 'svelte';
  import type { ServedLocale } from '../lib/locale';
  import { setPageLocale } from '../pages/pageLocale';

  /** A page component rendered in a locale, as the root layout (routes/+layout.svelte) renders it: for render tests. */
  let { locale, page: Page, props }: { locale: ServedLocale; page: Component<P>; props: P } = $props();

  // svelte-ignore state_referenced_locally
  setPageLocale(locale, []);
</script>

<Page {...props} />
