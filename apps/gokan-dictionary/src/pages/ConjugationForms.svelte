<script lang="ts">
  import { conjugate, isAdjectiveClass, type FormLabel, type ConjugationClass } from '@gokan/dataset-schema';
  import { formRomajiParts } from '../lib/romaji';
  import { pageLocale } from './pageLocale';

  const { forms } = pageLocale().messages.vocab;

  /**
   * A verb's or adjective's forms (@gokan/dataset-schema's conjugation.ts): plain and polite,
   * present and past, affirmative and negative as one grid, then the other forms, an adjective's
   * its own (te-form, adverbial, conditional), never a verb's potential or imperative. Each form has its kana under
   * it when the word is written with kanji, and on an English page its romaji under that (#278):
   * 勉強します, benkyoushimasu, is what a learner who does not read kana searches for. It may wrap
   * at 320px, so only between morae (formRomajiParts): torimase<wbr>n<wbr>de..., never torimasende|shita.
   * On a phone a grid row's Plain and Polite stack under its label, each named by its cell's
   * data-label (the column heads are hidden there, never removed: screen readers still name each
   * cell's column), so a form has the full width (vocab.scss). The grid and the other forms are one
   * table with two bodies, so they share one label column, sized by the table's own auto layout.
   */
  interface Props {
    word: string;
    reading: string;
    wordClass: ConjugationClass;
    /** Each form's romaji under it: an English page's. */
    romaji?: boolean;
  }

  let { word, reading, wordClass, romaji = false }: Props = $props();

  const written = $derived(new Map(conjugate(word, wordClass).map(({ label, form }) => [label, form])));
  const kana = $derived(new Map(conjugate(reading, wordClass).map(({ label, form }) => [label, form])));

  const GRID: { row: string; plain: FormLabel; polite: FormLabel }[] = [
    { row: forms.present, plain: 'plain', polite: 'polite' },
    { row: forms.negative, plain: 'negative', polite: 'polite-negative' },
    { row: forms.past, plain: 'past', polite: 'polite-past' },
    { row: forms.pastNegative, plain: 'past-negative', polite: 'polite-past-negative' },
  ];
  const VERB_OTHER: FormLabel[] = ['te', 'potential', 'passive', 'causative', 'volitional', 'imperative', 'ba', 'tara'];
  // 高く, 静かに; ければ for an い-adjective, なら for a な-adjective.
  const ADJECTIVE_OTHER: FormLabel[] = ['te', 'adverbial', 'ba', 'nara'];
  const others = $derived((isAdjectiveClass(wordClass) ? ADJECTIVE_OTHER : VERB_OTHER).filter(label => written.has(label)));
</script>

{#snippet form(label: FormLabel)}
  {@const spoken = kana.get(label)}
  <span lang="ja">{written.get(label)}</span>{#if spoken && spoken !== written.get(label)}<small lang="ja">{spoken}</small>{/if}{#if romaji && spoken}<small lang="ja-Latn">{#each formRomajiParts(spoken) as part, at (at)}{#if at > 0}<wbr>{/if}{part}{/each}</small>{/if}
{/snippet}

<!-- The roles are explicit, not redundant: on a phone the stacked rows are display: block
     (vocab.scss), which drops a table's implicit roles in Chrome and Safari; written ones survive it. -->
<!-- svelte-ignore a11y_no_redundant_roles -->
<table class="forms" role="table">
  <thead role="rowgroup">
    <tr role="row"><td role="cell"></td><th scope="col" role="columnheader">{forms.plain}</th><th scope="col" role="columnheader">{forms.polite}</th></tr>
  </thead>
  <tbody role="rowgroup">
    {#each GRID as line (line.row)}
      <tr role="row"><th scope="row" role="rowheader">{line.row}</th><td role="cell" data-label={forms.plain}>{@render form(line.plain)}</td><td role="cell" data-label={forms.polite}>{@render form(line.polite)}</td></tr>
    {/each}
  </tbody>
  {#if others.length > 0}
    <!-- The other forms: one form a row, across both form columns, so they start under Plain. -->
    <tbody class="forms-other" role="rowgroup">
      {#each others as label (label)}
        <tr role="row"><th scope="row" role="rowheader">{forms.labels[label]}</th><td role="cell" colspan="2">{@render form(label)}</td></tr>
      {/each}
    </tbody>
  {/if}
</table>
