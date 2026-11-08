<script lang="ts">
  import GrammarIndexPage from '../../pages/GrammarIndexPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<GrammarIndexPage {...data.props} />
