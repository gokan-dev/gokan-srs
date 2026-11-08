<script lang="ts">
  import GrammarFamiliesIndexPage from '../../../../pages/GrammarFamiliesIndexPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<GrammarFamiliesIndexPage {...data.props} />
