<script lang="ts">
  import GrammarConjugationsIndexPage from '../../../../pages/GrammarConjugationsIndexPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<GrammarConjugationsIndexPage {...data.props} />
