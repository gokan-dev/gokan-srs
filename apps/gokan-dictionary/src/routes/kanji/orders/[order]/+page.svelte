<script lang="ts">
  import KanjiOrderPage from '../../../../pages/KanjiOrderPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<KanjiOrderPage {...data.props} />
