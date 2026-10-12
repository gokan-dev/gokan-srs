<script lang="ts">
  import { conjugate, FORM_LABELS, type FormLabel, type WordClass } from '../lib/conjugation';

  /**
   * A verb's or い-adjective's forms (lib/conjugation.ts): plain and polite, present and past,
   * affirmative and negative as one grid, then the other forms. Each form has its kana under
   * it when the word is written with kanji.
   */
  interface Props {
    word: string;
    reading: string;
    wordClass: WordClass;
  }

  let { word, reading, wordClass }: Props = $props();

  const written = $derived(new Map(conjugate(word, wordClass).map(({ label, form }) => [label, form])));
  const kana = $derived(new Map(conjugate(reading, wordClass).map(({ label, form }) => [label, form])));

  const GRID: { row: string; plain: FormLabel; polite: FormLabel }[] = [
    { row: 'Present', plain: 'plain', polite: 'polite' },
    { row: 'Negative', plain: 'negative', polite: 'polite-negative' },
    { row: 'Past', plain: 'past', polite: 'polite-past' },
    { row: 'Past negative', plain: 'past-negative', polite: 'polite-past-negative' },
  ];
  const OTHER: FormLabel[] = ['te', 'potential', 'passive', 'causative', 'volitional', 'imperative', 'ba', 'tara'];
  const others = $derived(OTHER.filter(label => written.has(label)));
</script>

{#snippet form(label: FormLabel)}
  <span lang="ja">{written.get(label)}</span>{#if kana.get(label) && kana.get(label) !== written.get(label)}<small lang="ja">{kana.get(label)}</small>{/if}
{/snippet}

<table class="forms">
  <thead>
    <tr><td></td><th scope="col">Plain</th><th scope="col">Polite</th></tr>
  </thead>
  <tbody>
    {#each GRID as line (line.row)}
      <tr><th scope="row">{line.row}</th><td>{@render form(line.plain)}</td><td>{@render form(line.polite)}</td></tr>
    {/each}
  </tbody>
</table>

{#if others.length > 0}
  <table class="forms forms--list">
    <tbody>
      {#each others as label (label)}
        <tr><th scope="row">{FORM_LABELS[label]}</th><td>{@render form(label)}</td></tr>
      {/each}
    </tbody>
  </table>
{/if}
