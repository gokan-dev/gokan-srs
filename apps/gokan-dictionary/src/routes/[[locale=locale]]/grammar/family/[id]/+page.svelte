<script lang="ts">
  import GrammarFamilyPage from '../../../../../pages/GrammarFamilyPage.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<GrammarFamilyPage {...data.props} />
