<script lang="ts">
  import GrammarChaptersIndexPage from '../../../pages/GrammarChaptersIndexPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<GrammarChaptersIndexPage {...data.props} />
