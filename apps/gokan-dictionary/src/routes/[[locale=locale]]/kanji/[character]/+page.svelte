<script lang="ts">
  import KanjiPage from '../../../../pages/KanjiPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<KanjiPage {...data.props} />
