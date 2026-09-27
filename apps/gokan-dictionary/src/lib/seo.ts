// Pure per-page SEO metadata builders. Kept separate from the Svelte components so they're
// trivially unit-testable without rendering anything, and separate from documentShell.ts
// (which only knows how to wrap an already-decided {title, description} into HTML).

import type { Vocabulary } from '../models/vocabulary.model';
import type { Kanji } from '../models/kanji.model';
import type { GrammarChapter, GrammarPoint } from '../models/grammar.model';
import { SITE_NAME } from './site';

export interface PageMeta {
    title: string;
    description: string;
}

const JLPT_LABEL = (level: number) => `N${level}`;

export function vocabMeta(vocab: Vocabulary): PageMeta {
    const gloss = vocab.senses[0]?.glosses[0];
    const jlpt = vocab.jlptLevel ? ` (JLPT ${JLPT_LABEL(vocab.jlptLevel)})` : '';

    const title = `${vocab.writtenForm.kanji} (${vocab.reading.primary})${jlpt} - ${SITE_NAME}`;
    const description = gloss
        ? `${vocab.writtenForm.kanji} (${vocab.reading.primary}): ${gloss}. Japanese dictionary entry with readings, meanings, and usage examples.`
        : `${vocab.writtenForm.kanji} (${vocab.reading.primary}) - Japanese dictionary entry with readings and meanings.`;

    return { title, description };
}

export function kanjiMeta(kanji: Kanji, vocabCount: number): PageMeta {
    const jlpt = kanji.steps.jlpt ? ` (JLPT ${JLPT_LABEL(kanji.steps.jlpt)})` : '';
    const title = `${kanji.character}${jlpt} - Kanji - ${SITE_NAME}`;
    const description = vocabCount > 0
        ? `The kanji ${kanji.character}: KKLC step, JLPT level, and ${vocabCount} vocabulary word${vocabCount === 1 ? '' : 's'} that use it.`
        : `The kanji ${kanji.character}: KKLC step and JLPT level.`;

    return { title, description };
}

export function grammarMeta(point: GrammarPoint): PageMeta {
    const romaji = point.romaji ? ` (${point.romaji})` : '';
    const title = `${point.title}${romaji} - JLPT ${JLPT_LABEL(point.jlptLevel)} Grammar - ${SITE_NAME}`;

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
        description: `All ${kanjiCount.toLocaleString()} kanji, grouped by JLPT level, each with its readings, KKLC step, and the vocabulary that uses it.`,
    };
}

export function vocabIndexMeta(vocabCount: number): PageMeta {
    return {
        title: `Japanese Vocabulary Dictionary - ${SITE_NAME}`,
        description: `${vocabCount.toLocaleString()} Japanese words with readings, English meanings, JLPT levels, and example sentences. Browse by JLPT level or search.`,
    };
}

export function vocabJlptMeta(level: number, wordCount: number): PageMeta {
    return {
        title: `JLPT N${level} Vocabulary List (${wordCount.toLocaleString()} words) - ${SITE_NAME}`,
        description: `The complete JLPT N${level} vocabulary list: ${wordCount.toLocaleString()} words ordered by frequency, each with its reading, English meaning, and example sentences.`,
    };
}

export function homeMeta(): PageMeta {
    return {
        title: `${SITE_NAME} - Japanese Dictionary with Example Sentences`,
        description: 'Free Japanese dictionary: look up any word, kanji, or grammar point. Readings, English meanings, JLPT levels, and real example sentences with every word linked.',
    };
}
