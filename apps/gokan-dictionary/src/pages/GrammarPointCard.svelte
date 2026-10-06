<script lang="ts">
  import { FORMALITY_LABEL, KIND_LABEL, type BrowseRow } from '../lib/grammarBrowse';
  import { grammarPath } from '../lib/urls';

  /**
   * One grammar point as a card linking to its page. The static index and the interactive
   * browser both render this, so the fallback list and the mounted browser look identical.
   */
  interface Props {
    point: BrowseRow;
    /** Adds the usage note and the kind / register / family chips (the interactive browser). */
    detailed?: boolean;
    /** Show the family chip; redundant when the list is already grouped by family. */
    showFamily?: boolean;
  }

  let { point, detailed = false, showFamily = false }: Props = $props();
</script>

<a class="point-card" href={grammarPath(point.id)}>
  <span class="point-card-head">
    <span class="jp point-card-title">{point.title}</span>
    <span class="badge">N{point.jlptLevel}</span>
  </span>
  {#if point.romaji}<span class="point-card-romaji">{point.romaji}</span>{/if}
  <span class="point-card-explanation">{point.shortExplanation}</span>
  <span class="jp point-card-formation">{point.formation}</span>
  {#if detailed}
    {#if point.usageNote}<span class="point-card-note">{point.usageNote}</span>{/if}
    <span class="point-card-chips">
      {#if point.kind}<span class="chip-sm">{KIND_LABEL[point.kind]}</span>{/if}
      {#if point.formalityLevel}
        <span class="chip-sm">{FORMALITY_LABEL[point.formalityLevel] ?? point.formalityLevel}</span>
      {/if}
      {#if showFamily && point.familyName}
        <span class="chip-sm">{point.familyName}</span>
      {/if}
    </span>
  {/if}
</a>
