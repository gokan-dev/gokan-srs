<script lang="ts">
  import GrammarPage from '../../../pages/GrammarPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<GrammarPage {...data.props} />
