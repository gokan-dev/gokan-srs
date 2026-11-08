<script lang="ts">
  import KanjiRangePage from '../../../../../pages/KanjiRangePage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<KanjiRangePage {...data.props} />
