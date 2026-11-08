<script lang="ts">
  import VocabPage from '../../../../pages/VocabPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<VocabPage {...data.props} />
