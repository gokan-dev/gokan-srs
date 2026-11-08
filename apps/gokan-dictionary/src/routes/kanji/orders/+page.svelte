<script lang="ts">
  import KanjiOrdersPage from '../../../pages/KanjiOrdersPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<KanjiOrdersPage {...data.props} />
