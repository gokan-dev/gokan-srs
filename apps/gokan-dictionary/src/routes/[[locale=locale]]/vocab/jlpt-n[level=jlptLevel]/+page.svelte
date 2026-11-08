<script lang="ts">
  import VocabJlptPage from '../../../../pages/VocabJlptPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<VocabJlptPage {...data.props} />
