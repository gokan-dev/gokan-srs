<script lang="ts">
  // A word's primary reading with its pitch accent drawn over it (gokan-srs issue 176), as the SRS
  // app draws it: `pitchPaths` lays the dots out in em of the reading's font, so each sits over its
  // kana; the particle after the word is a hollow dot one em past the end. The most usual pattern
  // is on the reading itself, any other follows as the reading again, smaller, after a gap wider than
  // the one before a play button (so two contours never read as one line), with no mark between (a
  // later pattern that wraps would open its line with it). Screen
  // readers get the reading once and the patterns in words (`label`, the word page's catalog words,
  // which only the word page reads), inside the first pattern so a play button (`children`) follows
  // the reading itself: the first pattern then leaves it room on its line (`pa-b`), and a further
  // pattern follows the button, wrapping after it. On every word page, so in the fewest bytes (the
  // word page budget, lib/budgets.ts): three SVG elements, short classes, sizes in
  // styles/pages/vocab.scss (held equal to pitchPaths' by PitchAccent.test.ts).
  import type { Snippet } from 'svelte';
  import { pitchPaths, type PitchAccent, type PitchPaths } from '@gokan/dataset-schema';

  let { accent, label, children }: { accent: PitchAccent; label: string; children?: Snippet } = $props();
  const patterns = $derived(accent.downsteps.map(downstep => pitchPaths(accent.reading, downstep)));
</script>

{#snippet pattern(p: PitchPaths, other: boolean)}<span class={other ? 'pr pr-other' : 'pr'} style="--w:{p.width}"><svg aria-hidden="true" viewBox="0 0 {p.width} {p.height}"><path d={p.line} /><path class="pd" d={p.dots} /><circle cx={p.particle.cx} cy={p.particle.cy} r={p.radius} /></svg><span lang="ja" data-pitch-reading>{accent.reading}</span>{#if !other}<span class="visually-hidden">{label}</span>{/if}</span>{/snippet}

<span class={children ? 'pa pa-b' : 'pa'}>{#each patterns as p, i (i)}{#if i === 0}{@render pattern(p, false)}{@render children?.()}{:else}<span aria-hidden="true">{@render pattern(p, true)}</span>{/if}{/each}</span>
