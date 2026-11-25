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

<table class="forms">
  <thead>
    <tr><td></td><th scope="col">{forms.plain}</th><th scope="col">{forms.polite}</th></tr>
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
        <tr><th scope="row">{forms.labels[label]}</th><td>{@render form(label)}</td></tr>
      {/each}
    </tbody>
  </table>
{/if}
