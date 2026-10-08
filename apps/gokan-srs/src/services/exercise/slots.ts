// src/services/exercise/slots.ts
//
// Every accept-list in the app is assembled here. An exercise decides WHICH word
// or text a slot asks for; turning that into accepted forms is the same for every
// exercise, so a production card and a grammar blank asking for the same word
// accept the same answers, up to their OtherFormGrade.
import { headwordOf, headwordWithReading } from '@gokan/dataset-schema';
import type { Vocabulary } from '@gokan/dataset-schema';
import { isFormOfWord, kanaOfSurface, toInflectableWord } from '../../utils/inflection.utils';
import type { InflectableWord } from '../../utils/inflection.utils';
import { embeddedSynonymCandidate } from '../../utils/synonymContext.utils';
import type { AnswerSlot, OtherFormGrade, SlotInflection, SlotRole, SynonymCandidate, WordForms } from './types';

function unique(forms: (string | undefined)[]): string[] {
    return Array.from(new Set(forms.filter((f): f is string => !!f)));
}

/**
 * Every dictionary form of a word: readings (merged homographs' too), then written
 * forms. Primary reading first, since a typo is reported against the first form it
 * is close to.
 */
function dictionaryForms(vocab: WordForms): string[] {
    return unique([
        vocab.reading.primary,
        ...vocab.reading.alternatives,
        ...(vocab.mergedVocabs?.map(m => m.originalPrimaryReading) ?? []),
        vocab.writtenForm.kanji,
        ...vocab.writtenForm.alternatives,
    ]);
}

/** The word's near-synonyms as grading candidates, from the forms the dataset embeds on each entry. */
export function synonymsOf(vocab: Pick<Vocabulary, 'synonyms'>): SynonymCandidate[] {
    return (vocab.synonyms ?? []).map(embeddedSynonymCandidate);
}

/** Where a slot's word sits in a sentence: the form the sentence uses. */
export interface Occurrence {
    surface: string;
    /** The dataset stores the surface's reading on some tokens and the lemma's on others. */
    reading?: string;
    /** True when the surface is a conjugation of the word rather than one of its dictionary forms. */
    inflected: boolean;
}

/** The forms that fit the sentence as written: the surface, its kana as conjugated, and its own reading. */
function occurrenceForms(occurrence: Occurrence, lemma: InflectableWord): string[] {
    const forms = [occurrence.surface];
    // はやかろ for 早かろ, so the right answer typed in hiragana grades like the kanji one.
    if (occurrence.inflected) forms.push(kanaOfSurface(occurrence.surface, lemma) ?? '');
    // 早かろ carries はやい: a lemma reading is a dictionary form, never the form the blank wants.
    const lemmaReading = !!occurrence.reading && lemma.readings.includes(occurrence.reading);
    if (!(occurrence.inflected && lemmaReading)) forms.push(occurrence.reading ?? '');
    return unique(forms);
}

export interface WordSlotOptions {
    /** The word credited when the slot is answered right; omitted on a grammar marker, which practises the point. */
    vocabId?: string;
    occurrence?: Occurrence;
    otherForm: Exclude<OtherFormGrade, 'off'>;
    role: SlotRole;
    synonyms: SynonymCandidate[];
}

/**
 * A slot asking for one dictionary word, possibly as it occurs in a sentence. On a
 * card that also tests the conjugation (`otherForm: 'minor_error'`), a conjugated
 * occurrence's dictionary forms are the right word in the wrong form, so they are a
 * near miss; everywhere else they are ideal answers.
 */
export function wordSlot(vocab: WordForms, { vocabId, occurrence, otherForm, role, synonyms }: WordSlotOptions): AnswerSlot {
    const lemma = toInflectableWord(vocab);
    const dictionary = dictionaryForms(vocab);
    const dictionaryIsIdeal = otherForm === 'correct' || !occurrence?.inflected;
    const accept = unique([...(occurrence ? occurrenceForms(occurrence, lemma) : []), ...(dictionaryIsIdeal ? dictionary : [])]);
    return {
        accept,
        // The two tiers never overlap, or a right answer could be downgraded by match order.
        near: dictionaryIsIdeal ? [] : dictionary.filter(f => !accept.includes(f)),
        leniency: 'standard',
        role,
        reveal: occurrence?.surface ?? vocab.reading.primary,
        gloss: vocab.senses?.flatMap(s => s.glosses)[0] ?? '',
        word: {
            ...(vocabId ? { vocabId } : {}),
            label: headwordWithReading(vocab),
            headword: headwordOf(vocab),
            lemma,
            otherForm,
            synonyms,
        },
    };
}

/** The reading quiz's slot: the word's readings only, since reading means sounding out the written form. */
export function readingSlot(vocab: Pick<Vocabulary, 'reading'>): AnswerSlot {
    return {
        accept: unique([vocab.reading.primary, ...vocab.reading.alternatives]),
        near: [],
        leniency: 'standard',
        role: 'core',
        reveal: vocab.reading.primary,
        gloss: '',
    };
}

/**
 * The meaning quiz's slot: every gloss, split on its separators. Parentheses go
 * first so commas inside them ("go (to, from)") don't split the gloss, and a comma
 * inside a number (10,000) is not a separator. A miss reveals the first whole gloss.
 */
export function meaningSlot(glosses: string[]): AnswerSlot {
    const parts = glosses.flatMap(gloss => {
        let clean = gloss;
        let prev;
        do {
            prev = clean;
            clean = clean.replace(/\s*\([^()]*\)\s*/g, ' ');
        } while (clean !== prev);
        return clean.split(/;\s*|,(?!\d)\s*/).map(p => p.trim()).filter(p => p.length > 0);
    });
    return {
        accept: parts,
        near: [],
        leniency: 'standard',
        role: 'core',
        reveal: glosses[0] ?? '',
        gloss: '',
    };
}

/** One token of a grammar marker: its kana when known, and how its word inflects when it is one that does. */
export interface MarkerToken {
    surface: string;
    kana: string | null;
    word: InflectableWord | null;
}

/** A run of tokens as written, and in kana when every token's kana is known. */
function spellings(tokens: MarkerToken[]): string[] {
    if (tokens.length === 0) return [''];
    const kana = tokens.every(t => t.kana !== null) ? tokens.map(t => t.kana).join('') : undefined;
    return unique([tokens.map(t => t.surface).join(''), kana]);
}

/**
 * The conjugated words of a grammar marker (があります, なければならない), each with
 * the text around it, so the right construction in another conjugation grades as
 * one (がある, がありません, なければなりません). A word's inflection reaches as far
 * as the tokens after it still spell one of its forms (あり + ます is あります);
 * what follows is fixed text. `registerFree`: see SlotInflection.
 */
export function markerInflections(tokens: MarkerToken[], registerFree: boolean): SlotInflection[] {
    return tokens.flatMap((token, head) => {
        const { word } = token;
        if (!word) return [];
        let end = -1;
        for (let j = head; j < tokens.length; j++) {
            if (spellings(tokens.slice(head, j + 1)).some(s => isFormOfWord(s, word))) end = j;
        }
        if (end === -1) return [];
        return [{
            lead: spellings(tokens.slice(0, head)),
            word,
            form: spellings(tokens.slice(head, end + 1)),
            tail: spellings(tokens.slice(end + 1)),
            registerFree,
        }];
    });
}
