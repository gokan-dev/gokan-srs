<script lang="ts">
  import VocabIndexPage from '../../pages/VocabIndexPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<VocabIndexPage {...data.props} />
