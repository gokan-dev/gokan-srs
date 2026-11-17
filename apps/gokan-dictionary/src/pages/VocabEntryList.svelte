<script lang="ts">
  import type { VocabSummary } from '../lib/types';
  import { langOnChinesePage } from '../lib/documentShell';
  import { pageLocale } from './pageLocale';
  import { DEFAULT_LOCALE } from '../lib/locale';

  const { locale, urls, messages, lang } = pageLocale();
  // A row's note is in the page's language: marked only where that is not the document's own.
  const noteLang = locale === DEFAULT_LOCALE ? undefined : lang;

  /**
   * Words as three aligned columns, headword | reading | gloss, each row linking to the word.
   * Every page that lists words uses this, so a row looks and links the same everywhere. The
   * reading shows only when it differs from the headword, and a word learned in kana is never
   * listed by its rare kanji spelling. Past `visible` rows, the rest sit in a disclosure: still
   * in the HTML (crawlable, no script), just collapsed.
   *
   * A row is kept small (lang on the link, the headword a bare text cell, no classes): a kanji
   * page lists up to 660 words within its 80 KB budget. The gloss is the one span with a lang,
   * which is how the stylesheet finds its column (app.scss, .entry-list): the reading has none. On a page in another language a row's
   * gloss is the word's in it (localGloss), marked with the page's lang inside the Japanese link.
   * A row's note (a synonym's closeness) is a `small` under the gloss, which client/detailTabs.ts does not search.
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
  }

  let { entries, visible, stacked = false, briefRest = false, more }: Props = $props();

  const shown = $derived(visible === undefined ? entries : entries.slice(0, visible));
  const rest = $derived(visible === undefined ? [] : entries.slice(visible));
</script>

{#snippet rows(words: VocabSummary[], brief: boolean)}
  <ul class="entry-list" class:entry-list--stacked={stacked} class:entry-list--brief={brief}>
    {#each words as word (word.id)}
      <li><a href={urls.vocabPath(word.id)} lang="ja">{word.word}{#if word.reading}<span>{word.reading}</span>{/if}{#if !brief}{#if word.localGloss}<span lang={langOnChinesePage(word.localGloss) ?? lang}>{word.localGloss}</span>{:else}<span lang="en">{word.gloss ?? ''}</span>{/if}{#if word.note}<small lang={noteLang}>{word.note}</small>{/if}{/if}</a></li>
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
