<script lang="ts">
  import { setPageLocale } from '../pages/pageLocale';
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();

  // Set once: a page is rendered once, on the server, and never hydrated.
  // svelte-ignore state_referenced_locally
  setPageLocale(data.locale);
</script>

{@render children()}
