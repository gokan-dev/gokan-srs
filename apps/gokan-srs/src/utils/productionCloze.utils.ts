import { toHiragana } from '@gokan/dataset-schema';
import type { Sentence, SentenceMatch, Vocabulary } from '@gokan/dataset-schema';
import type { LearnerVocab } from './sentenceRanking';
import { pickSentenceForVocab } from './sentenceRanking';
import { readingMatchesWord, toInflectableWord, type InflectableWord } from './inflection.utils';
import { glossSpanIn, normalizeGloss } from './synonymContext.utils';

/** The target-vocab fields the cloze guard needs (see pickProductionClozeSentence). */
export type ClozeTargetVocab = Pick<Vocabulary, 'writtenForm' | 'reading'> & Partial<Pick<Vocabulary, 'senses'>>;

/**
 * A single sentence chosen to drive the production cloze card (issue #72): the
 * target word's span within `sentence.original`, straight from the dataset's
 * `matches[vocabId]` - no tokenization needed, unlike the grammar activity's
 * word-by-word blanking (`computeBlankPlan`), since a vocab sentence only needs
 * one span blanked.
 */
export interface ProductionCloze {
    sentence: Sentence;
    blankStart: number;
    blankLength: number;
    /**
     * The blanked span's own reading, conjugation included (たべたら for the 食べたら
     * span), from the same `matches` entry. Absent on data without one.
     */
    blankReading?: string;
}

/** The blanked text itself (食べたら): the form the sentence actually uses. */
export function blankSurfaceOf(cloze: ProductionCloze): string {
    return cloze.sentence.original.slice(cloze.blankStart, cloze.blankStart + cloze.blankLength);
}

const HAN = /\p{Script=Han}/u;
/** A numeral's own characters: kanji numerals and digits, half- and full-width. */
const NUMERAL = /[〇零一二三四五六七八九十百千万億兆0-9０-９]/u;

/**
 * True when the span is the word as written: it carries one of the word's kanji (食べたら for
 * 食べる), or it is in kana and starts as a reading does (たべたら, かれ for a word learned in
 * kana). A span that is neither writes the word another way: ３ for 三, ６ for 六.
 */
function writesTheWord(surface: string, word: InflectableWord): boolean {
    const kanji = new Set([...word.written.join('')].filter(c => HAN.test(c)));
    if ([...surface].some(c => kanji.has(c))) return true;
    const kana = toHiragana(surface);
    return word.readings.some(r => r.length > 0 && kana.startsWith(toHiragana(r)[0]));
}

/** True when a numeral span is part of a longer number: 十五 in 二十五, 三 in 三十. */
function insideLongerNumeral(original: string, match: SentenceMatch): boolean {
    const surface = original.slice(match.start, match.start + match.length);
    const before = original[match.start - 1] ?? '';
    const after = original[match.start + match.length] ?? '';
    return (NUMERAL.test(surface[0] ?? '') && NUMERAL.test(before))
        || (NUMERAL.test(surface[surface.length - 1] ?? '') && NUMERAL.test(after));
}

/**
 * Picks the sentence (and blank span within it) to drive this turn's production
 * cloze card, restricted to sentences carrying a usable `matches[vocabId]` entry
 * - a sentence with no match for this word cannot be blanked. When the word
 * appears more than once in the same sentence, the first occurrence is blanked;
 * "exactly one vocab word blanked" means one blank, not necessarily the only
 * occurrence of its surface form.
 *
 * Among usable sentences, the shared ranker (sentenceRanking.ts) picks the one
 * built most from words the learner is currently learning, the same rule the
 * grammar review uses. The word being tested is left out of the scoring, since
 * every candidate contains it. The pick is seeded on the vocab id alone, so the
 * same sentence keeps coming back until its surrounding words mature.
 *
 * When `vocab` is given, a sentence is usable only if the blanked span is
 * actually read as that word. The dataset keys sentence matches by written form,
 * so a form shared by differently-read homographs (遊ぶ is both あそぶ and the rare
 * すさぶ) can leave a sentence about あそぶ carrying a match for the すさぶ entry;
 * without this guard its cloze would blank 遊んでる and grade it correct against a
 * "grow wild" cue (the reported production-quiz bug). `readingMatchesWord` drops
 * such a match; a reading-mismatched sole candidate just falls back to the gloss
 * card. The same guard drops a span that writes the word another way (３ for 三: the card's
 * headword never appears in it) and a numeral inside a longer one (十五 in 二十五): neither is
 * the word in use, and the intro card shows this pick too. (Omitting `vocab` skips the guard -
 * used only by selection-logic tests.)
 *
 * Returns null when no sentence has a usable match - the caller reads that as
 * "fall back to the gloss-prompt card" (the `production` exercise). Coverage is
 * inherently partial: not every vocab has sentences, and not every sentence a
 * word appears in was tokenized with a resolved match for it.
 */
export function pickProductionClozeSentence(
    vocabId: string,
    sentences: Sentence[],
    learner: LearnerVocab,
    vocab?: ClozeTargetVocab,
): ProductionCloze | null {
    const word = vocab ? toInflectableWord(vocab) : null;
    const usable = sentences.filter(s => {
        const matches = s.matches?.[vocabId];
        if (!matches || matches.length === 0) return false;
        // The span this sentence would blank is matches[0] (the first occurrence).
        const match = matches[0];
        if (!word) return true;
        return readingMatchesWord(match.reading ?? '', word)
            && writesTheWord(s.original.slice(match.start, match.start + match.length), word)
            && !insideLongerNumeral(s.original, match);
    });
    const sentence = pickSentenceForVocab(vocabId, usable, learner);
    if (!sentence) return null;
    const match = sentence.matches![vocabId][0];

    return {
        sentence,
        blankStart: match.start,
        blankLength: match.length,
        ...(match.reading ? { blankReading: match.reading } : {}),
    };
}

/**
 * Best-effort emphasis for the production cloze card's English cue: which word in
 * the English translation corresponds to the blanked Japanese word. The bare cue
 * was too ambiguous to tell which of a long sentence's words to produce.
 *
 * There is no word-level JP<->EN alignment in the dataset, so this matches the
 * target vocab's own glosses against the translation: the most specific (longest)
 * gloss that appears as a whole word wins, and its span in the ORIGINAL text is
 * returned for in-place bolding. Conjugated or reworded translations often carry
 * no verbatim gloss ("has" for the gloss "to have"), so when nothing matches
 * `inline` is null and `labelGlosses` carries a few cleaned glosses for the
 * caller to show as an explicit label instead - so every card indicates the
 * word one way or the other (the chosen "bold gloss + label fallback" behaviour).
 */
export interface GlossEmphasis {
    inline: { before: string; match: string; after: string } | null;
    /** Cleaned glosses to show as a label when `inline` is null; empty otherwise. */
    labelGlosses: string[];
}

export function emphasizeGloss(englishText: string, glosses: string[]): GlossEmphasis {
    const cleaned = [...new Set(glosses.map(normalizeGloss).filter(g => g.length > 0))];

    // Inline match: try the most specific glosses first, and require >= 3 chars so an
    // incidental "be"/"do" is never bolded. Matched as grading matches a shared meaning
    // (glossSpanIn), so the word bolded is the one a synonym's context is judged by.
    const candidates = cleaned.filter(g => g.length >= 3).sort((a, b) => b.length - a.length);
    for (const cand of candidates) {
        const span = glossSpanIn(englishText, cand);
        if (span) {
            return {
                inline: {
                    before: englishText.slice(0, span.start),
                    match: englishText.slice(span.start, span.end),
                    after: englishText.slice(span.end),
                },
                labelGlosses: [],
            };
        }
    }

    return { inline: null, labelGlosses: cleaned.slice(0, 3) };
}
