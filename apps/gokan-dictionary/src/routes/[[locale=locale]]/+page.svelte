<script lang="ts">
  import HomePage from '../../pages/HomePage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<HomePage {...data.props} />
