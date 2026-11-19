<script lang="ts">
  // A word's primary reading with its pitch accent drawn over it (gokan-srs issue 176), as the SRS
  // app draws it: `pitchGraph` lays the dots out in em of the reading's font, so each sits over its
  // kana; the particle after the word is a hollow dot one em past the end. The most usual pattern
  // is on the reading itself, any other follows after a 、 as the reading again, smaller. Screen
  // readers get the reading once and the patterns in words (`label`, the word page's catalog words,
  // which only the word page reads). Styles in styles/pages/vocab.scss.
  import { pitchGraph, type PitchAccent } from '@gokan/dataset-schema';

  let { accent, label }: { accent: PitchAccent; label: string } = $props();
  const graphs = $derived(accent.downsteps.map(downstep => pitchGraph(accent.reading, downstep)));
</script>

<span class="pitch-accent">
  {#each graphs as g, i (i)}
    {#if i > 0}<span class="pitch-accent-sep" aria-hidden="true" lang="ja">、</span>{/if}
    <span class="pitch-reading" class:pitch-reading-other={i > 0} aria-hidden={i > 0 ? 'true' : undefined} style={`--pitch-width: ${g.width}; --pitch-height: ${g.height}em`}>
      <svg width="{g.width}em" height="{g.height}em" viewBox="0 0 {g.width} {g.height}" aria-hidden="true">
        {#each g.segments as s, index (index)}<line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />{/each}
        {#each g.points as p, index (index)}<circle cx={p.x} cy={p.y} r={g.radius} class:particle={p.particle} />{/each}
      </svg>
      <!-- What a play button beside it is held to (check:layout): the text's line, not the dots above it. -->
      <span lang="ja" data-pitch-reading>{accent.reading}</span>
    </span>
  {/each}
  <span class="visually-hidden">{label}</span>
</span>
