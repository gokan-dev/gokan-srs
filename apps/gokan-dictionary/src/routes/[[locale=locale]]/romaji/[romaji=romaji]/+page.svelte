<script lang="ts">
  import RomajiPage from '../../../../pages/RomajiPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<RomajiPage {...data.props} />
