<script lang="ts">
  // A word's primary reading with its pitch accent drawn over it (gokan-srs issue 176), as the SRS
  // app draws it: `pitchPaths` lays the dots out in em of the reading's font, so each sits over its
  // kana; the particle after the word is a hollow dot one em past the end. The most usual pattern
  // is on the reading itself, any other follows after a 、 as the reading again, smaller. Screen
  // readers get the reading once and the patterns in words (`label`, the word page's catalog words,
  // which only the word page reads). On every word page, so in the fewest bytes (the word page
  // budget, lib/budgets.ts): three SVG elements, short classes, sizes in styles/pages/vocab.scss.
  import { pitchPaths, type PitchAccent } from '@gokan/dataset-schema';

  let { accent, label }: { accent: PitchAccent; label: string } = $props();
  const patterns = $derived(accent.downsteps.map(downstep => pitchPaths(accent.reading, downstep)));
</script>

<span class="pa">{#each patterns as p, i (i)}{#if i > 0}<span class="pa-sep" aria-hidden="true" lang="ja">、</span>{/if}<span class={i > 0 ? 'pr pr-other' : 'pr'} aria-hidden={i > 0 ? 'true' : undefined} style="--w:{p.width}"><svg viewBox="0 0 {p.width} .56"><path d={p.line} /><path class="pd" d={p.dots} /><circle cx={p.particle.cx} cy={p.particle.cy} r={p.radius} /></svg><span lang="ja" data-pitch-reading>{accent.reading}</span></span>{/each}<span class="visually-hidden">{label}</span></span>
