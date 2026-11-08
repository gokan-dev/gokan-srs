<script lang="ts">
  import GrammarChapterPage from '../../../../../pages/GrammarChapterPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<GrammarChapterPage {...data.props} />
