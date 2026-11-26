<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { VocabSummary } from '../lib/types';
  import { langOnChinesePage } from '../lib/documentShell';
  import { pageLocale } from './pageLocale';

  const { urls, messages, lang } = pageLocale();

  /**
   * Words as three aligned columns, headword | reading | gloss, each row linking to the word.
   * Every page that lists words uses this, so a row looks and links the same everywhere. The
   * reading shows only when it differs from the headword, and a word learned in kana is never
   * listed by its rare kanji spelling. Past `visible` rows, the rest sit in a disclosure: still
   * in the HTML (crawlable, no script), just collapsed.
   *
   * A row is kept small (lang on the link, the headword a bare text cell, no classes): a kanji
   * page lists up to 660 words within its budget (BUDGETS.kanjiPageMax). The gloss is the one span with a lang,
   * which is how the stylesheet finds its column (app.scss, .entry-list): the reading has none. On a page in another language a row's
   * gloss is the word's in it (localGloss), marked with the page's lang inside the Japanese link.
   * A row's note (a synonym's closeness) is a `small` under the gloss, which client/detailTabs.ts does not search,
   * always marked with the page's lang: it sits inside the Japanese link, whose lang it would inherit otherwise.
   */
  interface Props {
    entries: VocabSummary[];
    /** Rows shown before the disclosure; all of them when omitted. */
    visible?: number;
    /** Headword and reading on one line, the gloss under them: for a narrow column. */
    stacked?: boolean;
    /** Leave the gloss out of the rows in the disclosure: headword and reading only. */
    briefRest?: boolean;
    /** The disclosure's summary, given how many rows it holds; "All N words" when omitted. */
    more?: (hidden: number) => string;
    /** A row's reading cell in place of its plain reading (a romaji page's, with its pitch accent): a span. */
    reading?: Snippet<[VocabSummary]>;
    /**
     * The note inside the gloss's cell rather than on a line of its own (a romaji page, whose notes
     * are what tell its words apart); its class centres the headword and reading on the two.
     */
    noteInGloss?: boolean;
  }

  let { entries, visible, stacked = false, briefRest = false, more, reading, noteInGloss = false }: Props = $props();

  const shown = $derived(visible === undefined ? entries : entries.slice(0, visible));
  const rest = $derived(visible === undefined ? [] : entries.slice(visible));
</script>

{#snippet rows(words: VocabSummary[], brief: boolean)}
  <ul class="entry-list" class:entry-list--stacked={stacked} class:entry-list--brief={brief} class:entry-list--note-in-gloss={noteInGloss}>
    {#each words as word (word.id)}
      <li><a href={urls.vocabPath(word.id)} lang="ja">{word.word}{#if reading}{@render reading(word)}{:else if word.reading}<span>{word.reading}</span>{/if}{#if !brief}<span lang={word.localGloss ? (langOnChinesePage(word.localGloss) ?? lang) : 'en'}>{word.localGloss || (word.gloss ?? '')}{#if noteInGloss && word.note}<small lang={lang}>{word.note}</small>{/if}</span>{#if !noteInGloss && word.note}<small lang={lang}>{word.note}</small>{/if}{/if}</a></li>
    {/each}
  </ul>
{/snippet}

{@render rows(shown, false)}
{#if rest.length > 0}
  <details class="disclosure">
    <summary>{more ? more(rest.length) : messages.chrome.allWords(entries.length)}</summary>
    {@render rows(rest, briefRest)}
  </details>
{/if}
