<script lang="ts">
  import KanjiIndexPage from '../../../pages/KanjiIndexPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<KanjiIndexPage {...data.props} />
