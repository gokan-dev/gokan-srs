<script lang="ts">
  import type { VocabPageProps as Props } from '../lib/pageProps';
  import { CLOSENESS_LABEL, frequencyBand, frequencyTop, headwordOf, secondaryForm, summaryGloss, textbookLessonsLabel, wordFrequencyRank } from '@gokan/dataset-schema';
  import type { Sentence } from '@gokan/dataset-schema';
  import { valueText, type DefinitionSense } from '@gokan/dataset-schema/text';
  import { pageLocale } from './pageLocale';
  import { langOnChinesePage } from '../lib/documentShell';
  import { meaningsOf, wordTextSummary, type SenseView } from '../lib/senses';
  import { sentenceRuns } from '../lib/furigana';
  import { conjugate, wordClassOf } from '../lib/conjugation';
  import { VISIBLE_SENTENCES } from '../lib/sentenceOrder';
  import { PREVIEW_MEANINGS, PREVIEW_ROWS, type SynonymGroup } from '../lib/synonyms';
  import type { VocabSummary } from '../lib/types';
  import { appUrl } from '../lib/appLinks';
  import AppPanel from './AppPanel.svelte';
  import PageLayout from './PageLayout.svelte';
  import VocabEntryList from './VocabEntryList.svelte';
  import Chip from './Chip.svelte';
  import DetailTabs from './DetailTabs.svelte';
  import ConjugationForms from './ConjugationForms.svelte';
  import FuriganaToggle from './FuriganaToggle.svelte';
  import HowCommon from './HowCommon.svelte';
  import SectionSearch from './SectionSearch.svelte';
  import SentenceText from './SentenceText.svelte';
  import PlayButton from './PlayButton.svelte';

  let { vocab, orderStep, components, parents, sentences, synonyms, text, translations, withoutPage, voice }: Props = $props();

  // A page in another language links its own words only, and its kanji at English's pages, marked (lib/localeLinks.ts).
  const { urls, messages, linkLang, lang } = pageLocale();
  const words = messages.vocab;

  /** From 1024px, a Related list's first rows; the rest under "Show N more". The app's full page shows the same. */
  const RELATED_VISIBLE = 5;
  /** The Dict section's example sentences, as the app's. */
  const DICT_EXAMPLES = 2;

  const headword = $derived(headwordOf(vocab));
  // Into the app at the step the word comes in at, its own page open once setup is done.
  const appLink = $derived(appUrl({ placement: 'word', vocabId: vocab.id, order: orderStep?.order.id, known: orderStep?.step }));
  // The single most important fact on the page, beside the word: a reader who searched for it
  // wants the meaning immediately, not after scrolling to the Meanings section.
  // On a page in another language (text), its own: the first equivalents, else its first definition's first sense.
  const summary = $derived(text ? wordTextSummary(text) : summaryGloss(vocab.senses));
  // A page in another language lists its own sources' meanings (shown renderings only) before
  // English's, for now. In the template that block touches the next one, so English's page keeps
  // its whitespace (check:parity --expect identical).
  const chineseSenses = $derived(text?.definitions.flatMap(definition => definition.senses) ?? []);
  const meanings = $derived(meaningsOf(vocab.senses));
  const commonCount = $derived(meanings.visible.length + meanings.more.length);
  // English's meanings on a page in another language are marked as English, for a screen reader's voice.
  const englishLang = $derived(text ? 'en' : undefined);
  // Only when the headword fits its class: a verb listed under an odd spelling gets no table
  // rather than a wrong one.
  const wordClass = $derived.by(() => {
    const found = wordClassOf(vocab.senses.flatMap(sense => sense.pos));
    return found && conjugate(headword, found).length > 0 ? found : null;
  });
  const examples = $derived(sentences.slice(0, DICT_EXAMPLES));
  const shownSentences = $derived(sentences.slice(0, VISIBLE_SENTENCES));
  const moreSentences = $derived(sentences.slice(VISIBLE_SENTENCES));
  const unlinked = $derived(new Set(withoutPage?.words));
  const kanjiWithoutPage = $derived(new Set(withoutPage?.kanji));
  const hasKanji = $derived(vocab.writtenForm.containedKanji.length > 0);
  const hasMadeOfOrUsedIn = $derived(components.length > 0 || parents.length > 0);
  const rank = $derived(wordFrequencyRank(vocab));
  const band = $derived(frequencyBand(rank));
  const shownGroups = $derived(synonyms.groups.slice(0, PREVIEW_MEANINGS));
  const moreGroups = $derived(synonyms.groups.slice(PREVIEW_MEANINGS));
  // A section's search only past one page, as the app's (usePagedPanel): when it ships more rows than it shows before "Show N more".
  const searchSentences = $derived(moreSentences.length > 0);
  const searchSynonyms = $derived(moreGroups.length > 0 || shownGroups.some(group => group.words.length > PREVIEW_ROWS));
  const searchRelated = $derived(components.length > RELATED_VISIBLE || parents.length > RELATED_VISIBLE);

  /**
   * The sections, in the app word page's names and order. Below 1024px each is a tab
   * (client/detailTabs.ts); its id is the URL hash the app uses for it, Dict's none.
   */
  const tabs = $derived([
    { id: 'dict', label: words.tabs.dict },
    ...(sentences.length > 0 ? [{ id: 'sentences', label: words.tabs.sentences }] : []),
    ...(synonyms.groups.length > 0 ? [{ id: 'synonyms', label: words.tabs.synonyms }] : []),
    ...(wordClass ? [{ id: 'forms', label: words.tabs.forms }] : []),
    ...(hasKanji ? [{ id: 'kanji', label: words.tabs.kanji }] : []),
    ...(hasMadeOfOrUsedIn ? [{ id: 'related', label: words.tabs.related }] : []),
  ]);

  /**
   * A synonym as a word list row: the meanings the two words share as its gloss (English's, as the
   * app's description), which a search reads, and its label (= Interchangeable) as the row's note,
   * in the page's language, which a search does not.
   */
  const synonymEntries = (group: SynonymGroup): VocabSummary[] => group.words.map(word => ({
    id: word.id,
    word: word.word,
    ...(word.reading ? { reading: word.reading } : {}),
    gloss: word.shared,
    note: `${CLOSENESS_LABEL[word.closeness].sign} ${words.closeness[word.closeness]}`,
  }));
  const linkedKanji = $derived(vocab.writtenForm.containedKanji.filter(character => !kanjiWithoutPage.has(character)));

  /**
   * Each source once, by its name in the page's language: a section's credit line on a page in
   * another language. A source the catalog does not name fails the page, never shown as its id
   * (check-build.ts also holds every source in the text files to a name).
   */
  const sourceName = (id: string): string => {
    const name = messages.sources[id];
    if (name === undefined) throw new Error(`[vocab] source "${id}" has no name in the catalog (lib/messages, sources)`);
    return name;
  };
  const sourceNames = (ids: readonly string[]) => [...new Set(ids.map(sourceName))];
  const meaningsCredit = $derived(text ? words.credit([
    ...sourceNames([...text.definitions.map(definition => definition.source.source), ...text.equivalents.flatMap(equivalent => equivalent.sources.map(source => source.source))]),
    ...(meanings.visible.length > 0 ? [words.englishMeaningsSource] : []),
  ]) : null);
  // A block of sentences names the sources of the ones it shows: Tatoeba's, then each translation's.
  const sentencesCreditOf = (list: readonly Sentence[]) => (translations ? words.credit([...new Set([
    words.sentencesSource,
    ...sourceNames(list.flatMap(sentence => {
      const translation = translations[sentence.id];
      return translation && translation.lang !== 'en' ? [translation.source.source] : [];
    })),
  ])]) : null);
  const sentencesCredit = $derived(sentencesCreditOf(sentences));
  // Dict's Examples are Tatoeba's too, shown on their own in a tab below 1024px: they carry their credit.
  const examplesCredit = $derived(sentencesCreditOf(examples));
</script>

{#snippet senseList(views: SenseView[])}
  <ol class="sense-list" start={views[0].number} lang={englishLang}>
    {#each views as sense (sense.number)}
      <li>
        {#if sense.pos}<p class="sense-pos">{sense.pos}</p>{/if}
        {sense.glosses}{#each sense.labels as label (label)}<span class="sense-label">{label}</span>{/each}
      </li>
    {/each}
  </ol>
{/snippet}

{#snippet localSenseList(senses: DefinitionSense[])}
  <ol class="sense-list">
    {#each senses as sense, index (index)}
      {@const glosses = sense.glosses.map(valueText).join('；')}
      <li>
        {#if sense.appliesToSpellings?.length || sense.appliesToReadings?.length}<p class="sense-applies" lang="ja">{[...(sense.appliesToSpellings ?? []), ...(sense.appliesToReadings ?? [])].join('、')}</p>{/if}
        <span lang={langOnChinesePage(glosses)}>{glosses}</span>{#each sense.tags ?? [] as tag, tagIndex (tagIndex)}<span class="sense-label" lang={langOnChinesePage(tag)}>{tag}</span>{/each}
      </li>
    {/each}
  </ol>
{/snippet}

{#snippet sentenceList(list: Sentence[])}
  <ul class="sentence-list">
    {#each list as sentence (sentence.id)}
      {@const translation = translations?.[sentence.id]}
      <li>
        <SentenceText runs={sentenceRuns(sentence, { targetVocabId: vocab.id, unlinked })} audio={sentence.audio} {voice} />
        {#if translations}
          {#if translation}<p class="sentence-en" lang={translation.lang === 'en' ? 'en' : undefined}>{translation.text}</p>{/if}
        {:else if sentence.en[0]}<p class="sentence-en">{sentence.en[0].text}</p>{/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet synonymGroup(group: SynonymGroup, rows: number | undefined)}
  <div class="synonym-group" data-search-group>
    <h3 class="synonym-group-title">{words.forMeaning(group.number)} · <span lang={englishLang}>{group.glosses}</span></h3>
    <VocabEntryList entries={synonymEntries(group)} visible={rows} more={words.showMore} />
  </div>
{/snippet}

<PageLayout trail={[{ label: messages.chrome.sections.vocab, href: urls.vocabIndexPath() }, { label: headword, jp: true }]} section="vocab" wide {voice}>
  <header class="entry-head">
    <h1 class="entry-word" lang="ja">{headword}</h1>

    {#if vocab.usuallyKana}
      <!-- Learned in kana (ここ): the headword already is the reading, so name the kanji spelling. -->
      <p class="entry-sub">{words.usuallyKana} <span lang="ja">{secondaryForm(vocab)}</span><PlayButton audio={vocab.audio} {voice} label={messages.chrome.play(headword)} /></p>
    {:else}
      <p class="entry-sub" lang="ja">{vocab.reading.primary}<PlayButton audio={vocab.audio} {voice} label={messages.chrome.play(headword)} inJapanese />{#if vocab.reading.alternatives.length > 0}<span class="meta" {lang}> · {words.alsoRead} <span lang="ja">{vocab.reading.alternatives.join('、')}</span></span>{/if}</p>
    {/if}

    {#if summary}<p class="entry-gloss" lang={text ? langOnChinesePage(summary) : undefined}>{summary}</p>{/if}

    {#if vocab.jlptLevel || vocab.writtenForm.alternatives.length > 0}
      <p class="chips">
        {#if vocab.jlptLevel}<Chip label={messages.jlptLabel(vocab.jlptLevel)} href={urls.vocabJlptPath(vocab.jlptLevel)} />{/if}
        {#if vocab.writtenForm.alternatives.length > 0}
          <span class="meta">{words.alsoWritten} <span lang="ja">{vocab.writtenForm.alternatives.join('、')}</span></span>
        {/if}
      </p>
    {/if}

    <!-- The facts row, as the app's header: how common the word is in words (its band says "common"), and where textbooks teach it. -->
    <dl class="entry-facts">
      <HowCommon label={words.howCommon.label} bars={band.bars} band={words.howCommon.bands[band.name]} reference={words.howCommon.reference(band.ranked && rank ? frequencyTop(rank) : null)} />
      {#if vocab.textbooks?.length}
        <!-- A textbook's name is English's (Genki L3), marked so on a page in another language. -->
        <div><dt>{words.textbooks}</dt><dd lang={text ? 'en' : undefined}>{textbookLessonsLabel(vocab.textbooks)}</dd></div>
      {/if}
    </dl>
  </header>

  <!--
    From 1024px the full page: Dict, Sentences, Synonyms and Forms in the main column, the
    navigation aids (Kanji, Related) aside.
  -->
  <DetailTabs {tabs} label={words.tabs.label} />

  <div class="entry-layout" data-detail-panels>
    <div class="entry-main">
      <div id="dict" class="detail-panel" data-default-panel>
        <section class="section">
          <h2>{words.sections.meanings}</h2>
          {#if text}
            {#if chineseSenses.length > 0}<h3 class="sense-group-label">{messages.meaningGroups.definitions}</h3>{@render localSenseList(chineseSenses)}{/if}
            {#if text.equivalents.length > 0}<h3 class="sense-group-label">{messages.meaningGroups.equivalents}</h3><p class="sense-equivalents">{#each text.equivalents as equivalent, index (index)}{index > 0 ? '、' : ''}<span lang={langOnChinesePage(equivalent.text)}>{equivalent.text}</span>{/each}</p>{/if}
            {#if meanings.visible.length > 0}<h3 class="sense-group-label">{messages.meaningGroups.english}</h3>{/if}
          {/if}{#if meanings.visible.length > 0}{@render senseList(meanings.visible)}{/if}
          {#if meanings.more.length > 0}
            <details class="disclosure">
              <summary>{words.showAllMeanings(commonCount)}</summary>
              {@render senseList(meanings.more)}
            </details>
          {/if}
          {#if meanings.rare.length > 0}
            <details class="disclosure">
              <summary>{words.rareMeanings(meanings.rare.length)}</summary>
              {@render senseList(meanings.rare)}
            </details>
          {/if}
          {#if meaningsCredit}<p class="meta source-credit">{meaningsCredit}</p>{/if}
        </section>

        <!-- After the meanings, never above them: a reader came for the definition, on a phone most of all. -->
        <AppPanel link={appLink} copy={orderStep ? messages.appPanel.word(headword, orderStep) : messages.appPanel.general} />

        {#if examples.length > 0}
          <section class="section">
            <div class="section-head">
              <h2>{words.sections.examples}</h2>
              <FuriganaToggle />
            </div>
            {@render sentenceList(examples)}
            {#if examplesCredit}<p class="meta source-credit">{examplesCredit}</p>{/if}
          </section>
        {/if}

        {#if synonyms.closest}
          <section class="section">
            <h2>{words.sections.closestSynonyms}</h2>
            <VocabEntryList entries={synonymEntries(synonyms.closest)} />
            <p class="meta">{words.forMeaning(synonyms.closest.number)} · <span lang={englishLang}>{synonyms.closest.glosses}</span></p>
          </section>
        {/if}
      </div>

      {#if sentences.length > 0}
        <section id="sentences" class="section detail-panel" data-section-searchable>
          <div class="section-head">
            <h2>{words.sections.sentences}</h2>
            <FuriganaToggle />
          </div>
          {#if searchSentences}<SectionSearch label={words.search.sentences} placeholder={words.search.placeholders.sentences} />{/if}
          {@render sentenceList(shownSentences)}
          {#if moreSentences.length > 0}
            <details class="disclosure">
              <summary>{words.showMore(moreSentences.length)}</summary>
              {@render sentenceList(moreSentences)}
            </details>
          {/if}
          {#if sentencesCredit}<p class="meta source-credit">{sentencesCredit}</p>{/if}
        </section>
      {/if}

      {#if synonyms.groups.length > 0}
        <section id="synonyms" class="section detail-panel" data-section-searchable>
          <h2>{words.sections.synonyms}</h2>
          {#if searchSynonyms}<SectionSearch label={words.search.synonyms} placeholder={words.search.placeholders.synonyms} />{/if}
          {#each shownGroups as group (group.number)}{@render synonymGroup(group, PREVIEW_ROWS)}{/each}
          {#if moreGroups.length > 0}
            <details class="disclosure">
              <summary>{words.showMoreMeanings(moreGroups.length)}</summary>
              {#each moreGroups as group (group.number)}{@render synonymGroup(group, undefined)}{/each}
            </details>
          {/if}
          {#if synonyms.left > 0}<p class="meta">{words.synonymsNotListed(synonyms.left)}</p>{/if}
        </section>
      {/if}

      {#if wordClass}
        <section id="forms" class="section detail-panel">
          <h2>{words.sections.forms}</h2>
          <ConjugationForms word={headword} reading={vocab.reading.primary} {wordClass} />
        </section>
      {/if}
    </div>

    {#if hasKanji || hasMadeOfOrUsedIn}
      <aside class="entry-aside">
        {#if hasKanji}
          <section id="kanji" class="section detail-panel">
            <h2>{words.sections.kanji}</h2>
            <ul class="kanji-tiles">
              {#each vocab.writtenForm.containedKanji as character, index (index)}
                <li>{#if kanjiWithoutPage.has(character)}<span lang="ja">{character}</span>{:else}<a href={urls.kanjiPath(character)} hreflang={linkLang(urls.kanjiPath(character))} lang="ja">{character}</a>{/if}</li>
              {/each}
            </ul>
            {#if linkedKanji.length > 0 && linkLang(urls.kanjiPath(linkedKanji[0]))}<p class="meta">{words.kanjiInEnglish}</p>{/if}
          </section>
        {/if}

        {#if hasMadeOfOrUsedIn}
          <section id="related" class="section detail-panel" data-section-searchable>
            <h2>{words.sections.related}</h2>
            {#if searchRelated}<SectionSearch label={words.search.related} placeholder={words.search.placeholders.related} />{/if}
            {#if components.length > 0}
              <div data-search-group>
                <h3 class="related-title">{words.sections.madeOf}</h3>
                <VocabEntryList entries={components} visible={RELATED_VISIBLE} stacked more={words.showMore} />
              </div>
            {/if}
            {#if parents.length > 0}
              <div data-search-group>
                <h3 class="related-title">{words.sections.usedIn}</h3>
                <VocabEntryList entries={parents} visible={RELATED_VISIBLE} stacked more={words.showMore} />
              </div>
            {/if}
          </section>
        {/if}
      </aside>
    {/if}
  </div>
</PageLayout>
