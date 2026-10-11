// Pure per-page SEO metadata builders. Kept separate from the Svelte components so they're
// trivially unit-testable without rendering anything, and separate from documentShell.ts
// (which only knows how to wrap an already-decided {title, description} into HTML).

import { headwordOf, secondaryForm } from '@gokan/dataset-schema';
import type { GrammarChapter, GrammarPoint, Kanji, Vocabulary } from '@gokan/dataset-schema';
import { SITE_NAME } from './site';

export interface PageMeta {
    title: string;
    description: string;
}

const JLPT_LABEL = (level: number) => `N${level}`;

// Titles lead with the words a learner types ("思う meaning", "を問わず meaning", "て-form
// conjugation") and put the English meaning on the result line itself: Search Console showed
// the old Japanese-only titles surfacing almost solely for Japanese-language queries, where
// the big Japanese dictionaries win. Everything past ~60 chars may be cut, so the site name
// goes last.
const TITLE_MEANING_LENGTH = 40;

export function vocabMeta(vocab: Vocabulary): PageMeta {
    const meaning = vocab.senses[0]?.glosses.slice(0, 2).join(', ');
    const jlpt = vocab.jlptLevel ? ` | JLPT ${JLPT_LABEL(vocab.jlptLevel)}` : '';
    // "思う (おもう)", or "ここ (此処)" for a word learned in kana: both spellings stay searchable.
    const label = `${headwordOf(vocab)} (${secondaryForm(vocab)})`;

    const title = meaning
        ? `${label} meaning: ${truncate(meaning, TITLE_MEANING_LENGTH)}${jlpt} - ${SITE_NAME}`
        : `${label} meaning${jlpt} - ${SITE_NAME}`;
    const description = meaning
        ? `${label} means "${meaning}" in English. Readings, every meaning, JLPT level, and example sentences with each word linked.`
        : `${label}: Japanese dictionary entry with readings, meanings, and example sentences.`;

    return { title, description };
}

export function kanjiMeta(kanji: Kanji, vocabCount: number): PageMeta {
    const jlpt = kanji.steps.jlpt ? ` (JLPT ${JLPT_LABEL(kanji.steps.jlpt)})` : '';
    // The dataset has no kanji meanings or readings yet, so the title promises only what the
    // page shows: the level and the words written with it.
    const title = vocabCount > 0
        ? `${kanji.character} kanji${jlpt}: words using ${kanji.character} - ${SITE_NAME}`
        : `${kanji.character} kanji${jlpt} - ${SITE_NAME}`;
    const description = vocabCount > 0
        ? `The kanji ${kanji.character}: KKLC step, JLPT level, and ${vocabCount} vocabulary word${vocabCount === 1 ? '' : 's'} that use it.`
        : `The kanji ${kanji.character}: KKLC step and JLPT level.`;

    return { title, description };
}

export function grammarMeta(point: GrammarPoint): PageMeta {
    const level = `JLPT ${JLPT_LABEL(point.jlptLevel)} grammar`;
    let title: string;
    if (point.kind === 'inflection' && point.derives) {
        // A conjugation is searched by its name ("causative form", "te-form"), not its pattern.
        title = `${sentenceCase(point.derives)} conjugation and usage | ${level} - ${SITE_NAME}`;
    } else {
        const pattern = searchablePattern(point.title) || point.title;
        const romaji = point.romaji ? searchablePattern(point.romaji) : '';
        const gloss = quotedGlosses(point.shortExplanation);
        const label = romaji ? `${pattern} (${romaji})` : pattern;
        title = gloss
            ? `${label} meaning: ${truncate(gloss, TITLE_MEANING_LENGTH)} | ${level} - ${SITE_NAME}`
            : `${label} meaning and usage | ${level} - ${SITE_NAME}`;
    }

    // The short explanation is already a one-line summary written for a learner, so it makes a
    // better meta description than anything synthesised from the other fields. Trimmed to keep
    // the whole description inside the ~155 chars Google typically renders.
    const summary = point.shortExplanation.replace(/\s+/g, ' ').trim();
    const description = `${point.title}: ${truncate(summary, 120)} JLPT ${JLPT_LABEL(point.jlptLevel)} Japanese grammar with formation and example sentences.`;

    return { title, description };
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Entry titles are sentence case: "causative (させる)" -> "Causative (させる)". "i-adjective" and
 * "na-adjective" stay lowercase, as learners write them ("I-adjective" reads as a typo), and a
 * title starting with Japanese has no case to change.
 */
export function sentenceCase(text: string): string {
    if (/^(?:i|na)-/.test(text)) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// Slot placeholders the dataset writes into patterns ("Noun を余儀なくされる", "い-Adjective く",
// "Verb-te kureru"). Nobody types them into a search box.
const PATTERN_PLACEHOLDER = /(?:[いな]-)?\b(?:i-Adjective|na-Adjective|Adjective|Noun|Verb)\d?/g;

/**
 * A grammar pattern as a learner searches it: "～を問わず" -> "を問わず", "Noun から Noun に至る"
 * -> "からに至る", "Verb-te kureru" -> "te kureru". Japanese is written without spaces, so the
 * gaps a removed placeholder leaves between Japanese characters close up; romaji keeps its own.
 */
export function searchablePattern(pattern: string): string {
    return pattern
        .replace(PATTERN_PLACEHOLDER, ' ')
        .replace(/[～〜~+]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/(?<=[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}ー、。]) (?=[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}ー、。])/gu, '')
        .replace(/^[\s\-:、,]+|[\s\-:、,]+$/g, '');
}

/**
 * The quoted English equivalents in a short explanation ("Means 'regardless of' or
 * 'irrespective of'." -> "regardless of, irrespective of"), at most two. The lookarounds keep
 * an apostrophe inside a word ("isn't") from closing a quote.
 */
export function quotedGlosses(explanation: string): string | undefined {
    const glosses = [...explanation.matchAll(/(?<![A-Za-z])'(.+?)'(?![A-Za-z])/g)]
        .map(match => match[1].trim())
        .filter(gloss => gloss.length > 0)
        .slice(0, 2);
    return glosses.length > 0 ? glosses.join(', ') : undefined;
}

export function grammarIndexMeta(pointCount: number): PageMeta {
    return {
        title: `Japanese Grammar Points by JLPT Level - ${SITE_NAME}`,
        description: `All ${pointCount} Japanese grammar points, organized from JLPT N5 to N1, each with its formation pattern, explanation, and example sentences.`,
    };
}

export function grammarChaptersIndexMeta(chapterCount: number, pointCount: number): PageMeta {
    return {
        title: `Japanese Grammar Curriculum - ${chapterCount} Chapters - ${SITE_NAME}`,
        description: `The full JLPT N5-N1 grammar teaching order: ${chapterCount} chapters covering ${pointCount} grammar points, grouped the way they are actually taught together.`,
    };
}

export function grammarChapterMeta(chapter: GrammarChapter): PageMeta {
    const title = `${chapter.title} - Grammar Chapter ${chapter.jlptLevel ? `(N${chapter.jlptLevel})` : ''} - ${SITE_NAME}`;
    const summary = chapter.summary.replace(/\s+/g, ' ').trim();
    const description = `${chapter.title}: ${truncate(summary, 120)} ${chapter.points.length} grammar point${chapter.points.length === 1 ? '' : 's'} taught together in this chapter.`;

    return { title, description };
}

export function grammarFamilyMeta(familyName: string, memberCount: number): PageMeta {
    return {
        title: `${familyName} - Japanese Grammar Comparison - ${SITE_NAME}`,
        description: `${familyName}: ${memberCount} related Japanese grammar points compared side by side, with guidance on which one to reach for and why.`,
    };
}

export function grammarConjugationsIndexMeta(formCount: number, pointCount: number): PageMeta {
    return {
        title: `Japanese Verb and Adjective Conjugation Reference - ${SITE_NAME}`,
        description: `${formCount} conjugation forms across ${pointCount} inflection patterns (te-form, potential, causative, and more), each with a full table of example verbs and adjectives.`,
    };
}

export function kanjiIndexMeta(kanjiCount: number): PageMeta {
    return {
        title: `Kanji List by JLPT Level - ${SITE_NAME}`,
        description: `All ${kanjiCount.toLocaleString()} kanji, grouped by JLPT level, each with its KKLC step and the vocabulary that uses it.`,
    };
}

export function vocabIndexMeta(vocabCount: number): PageMeta {
    return {
        title: `Japanese Vocabulary Dictionary - ${SITE_NAME}`,
        description: `${vocabCount.toLocaleString()} Japanese words with readings, English meanings, JLPT levels, and example sentences. Browse by JLPT level or search.`,
    };
}

/** A JLPT list page; pages after the first say which page they are, so their titles stay distinct. */
export function vocabJlptMeta(level: number, wordCount: number, page = 1): PageMeta {
    const pageLabel = page > 1 ? `, page ${page}` : '';
    return {
        title: `JLPT N${level} Vocabulary List (${wordCount.toLocaleString('en')} words)${pageLabel} - ${SITE_NAME}`,
        description: `The complete JLPT N${level} vocabulary list${pageLabel}: ${wordCount.toLocaleString('en')} words ordered by frequency, each with its reading, English meaning, and example sentences.`,
    };
}

export function grammarFamiliesIndexMeta(familyCount: number): PageMeta {
    return {
        title: `Japanese Grammar Families: Near-Synonyms Compared - ${SITE_NAME}`,
        description: `${familyCount} groups of Japanese grammar near-synonyms, such as でも, しかし and けれども, each compared on its own page.`,
    };
}

/** The search results page: kept out of search engines (noindex), but it still needs a title. */
export function searchMeta(): PageMeta {
    return {
        title: `Search - ${SITE_NAME}`,
        description: 'Search the Japanese dictionary in kanji, kana, romaji or English.',
    };
}

export function homeMeta(): PageMeta {
    return {
        title: `${SITE_NAME} - Japanese Dictionary with Example Sentences`,
        description: 'Free Japanese dictionary: look up any word, kanji, or grammar point. Readings, English meanings, JLPT levels, and real example sentences with every word linked.',
    };
}
