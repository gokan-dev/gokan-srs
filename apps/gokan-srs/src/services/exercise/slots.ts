// src/services/exercise/slots.ts
//
// Every accept-list in the app is assembled here. An exercise decides WHICH word
// or text a slot asks for; turning that into accepted forms is the same for every
// exercise, so a production card and a grammar blank asking for the same word
// accept the same answers, up to their OtherFormGrade.
import { headwordOf, headwordWithReading } from '@gokan/dataset-schema';
import type { ConjugationDrillItem, Vocabulary } from '@gokan/dataset-schema';
import { hashString } from '../../utils/deterministicPick';
import { isFormOfWord, kanaOfSurface, toInflectableWord } from '../../utils/inflection.utils';
import type { InflectableWord } from '../../utils/inflection.utils';
import { demonstrativeParadigm } from './demonstratives';
import type { AnswerSlot, OtherFormGrade, SlotChoice, SlotInflection, SlotRole, SynonymCandidate, WordForms } from './types';

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
    /** The word's near-synonyms (synonymsOf in wordRelation.ts). */
    candidates: SynonymCandidate[];
}

/**
 * A slot asking for one dictionary word, possibly as it occurs in a sentence. On a
 * card that also tests the conjugation (`otherForm: 'minor_error'`), a conjugated
 * occurrence's dictionary forms are the right word in the wrong form, so they are a
 * near miss; everywhere else they are ideal answers.
 */
export function wordSlot(vocab: WordForms, { vocabId, occurrence, otherForm, role, candidates }: WordSlotOptions): AnswerSlot {
    const lemma = toInflectableWord(vocab);
    const dictionary = dictionaryForms(vocab);
    const dictionaryIsIdeal = otherForm === 'correct' || !occurrence?.inflected;
    const accept = unique([...(occurrence ? occurrenceForms(occurrence, lemma) : []), ...(dictionaryIsIdeal ? dictionary : [])]);
    return {
        accept,
        // The two tiers never overlap, or a right answer could be downgraded by match order.
        near: dictionaryIsIdeal ? [] : dictionary.filter(f => !accept.includes(f)),
        leniency: 'standard',
        script: 'japanese',
        role,
        reveal: occurrence?.surface ?? vocab.reading.primary,
        gloss: vocab.senses?.flatMap(s => s.glosses)[0] ?? '',
        word: {
            ...(vocabId ? { vocabId } : {}),
            label: headwordWithReading(vocab),
            headword: headwordOf(vocab),
            lemma,
            otherForm,
            candidates,
        },
    };
}

/** The reading quiz's slot: the word's readings only, since reading means sounding out the written form. */
export function readingSlot(vocab: Pick<Vocabulary, 'reading'>): AnswerSlot {
    return {
        accept: unique([vocab.reading.primary, ...vocab.reading.alternatives]),
        near: [],
        leniency: 'standard',
        script: 'japanese',
        role: 'core',
        reveal: vocab.reading.primary,
        gloss: '',
    };
}

/**
 * The meaning quiz's slot: every gloss, split on its separators. Parentheses go
 * first so commas inside them ("go (to, from)") don't split the gloss, and a comma
 * inside a number (10,000) is not a separator. A miss reveals the first whole gloss.
 * `reading` names the word, so a demonstrative's slot carries its series.
 */
export function meaningSlot(glosses: string[], reading?: string): AnswerSlot {
    const parts = glosses.flatMap(gloss => {
        let clean = gloss;
        let prev;
        do {
            prev = clean;
            clean = clean.replace(/\s*\([^()]*\)\s*/g, ' ');
        } while (clean !== prev);
        return clean.split(/;\s*|,(?!\d)\s*/).map(p => p.trim()).filter(p => p.length > 0);
    });
    const paradigm = reading === undefined ? undefined : demonstrativeParadigm(reading, parts);
    return {
        accept: parts,
        near: [],
        leniency: 'gloss',
        script: 'english',
        role: 'core',
        reveal: glosses[0] ?? '',
        gloss: '',
        ...(paradigm ? { paradigm } : {}),
    };
}

export interface TextSlotOptions {
    /** The text as the sentence writes it. */
    surface: string;
    /** The same text in kana, when every part of it has a known reading. */
    reading?: string | null;
    role: SlotRole;
    /** The conjugated words inside the text (markerInflections). */
    inflections?: SlotInflection[];
    /** See AnswerSlot.given. */
    given?: string;
}

/**
 * A slot asking for a run of text exactly as the sentence writes it: a grammar
 * marker, alone or together with the word it attaches to. No dictionary word is
 * behind it, so only the text and its kana answer it; its conjugated words grade
 * another conjugation through `inflections`.
 */
export function textSlot({ surface, reading, role, inflections = [], given }: TextSlotOptions): AnswerSlot {
    return {
        accept: unique([surface, reading ?? undefined]),
        near: [],
        leniency: 'standard',
        script: 'japanese',
        role,
        reveal: surface,
        gloss: '',
        ...(inflections.length > 0 ? { inflections } : {}),
        ...(given ? { given } : {}),
    };
}

export interface ChoiceSlotOptions {
    /** The text that fits. */
    answer: string;
    /** The wrong options, each with why it does not fit. */
    distractors: Required<SlotChoice>[];
    role: SlotRole;
    /** Orders the options: the same seed always gives the same order, so a recomputed turn does not reshuffle. */
    seed: string;
}

/** A slot answered by picking one option (AnswerSlot.choices). The right one sits wherever the seed puts it. */
export function choiceSlot({ answer, distractors, role, seed }: ChoiceSlotOptions): AnswerSlot {
    const choices: SlotChoice[] = [{ text: answer }, ...distractors]
        .sort((a, b) => hashString(`${seed}:${a.text}`) - hashString(`${seed}:${b.text}`) || a.text.localeCompare(b.text));
    return { ...textSlot({ surface: answer, role }), choices };
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

/**
 * The endings an inflection point's drill writes more than one way, each group the
 * spellings of one ending: what an item's answer and its listed alternative differ
 * by after the stem they share (じゃなかった / ではなかった, せられる / される). An
 * alternative is paired with the answer in its own script, written or kana.
 */
export function endingSpellings(items: Pick<ConjugationDrillItem, 'target' | 'targetReading' | 'alternatives'>[]): string[][] {
    const groups: string[][] = [];
    for (const item of items) {
        for (const alternative of item.alternatives ?? []) {
            const answer = [item.target, item.targetReading].find(t => t[0] === alternative[0]);
            if (!answer) continue;
            let shared = 0;
            while (shared < answer.length && answer[shared] === alternative[shared]) shared++;
            const pair = [answer.slice(shared), alternative.slice(shared)];
            if (shared === 0 || pair.some(ending => ending.length === 0)) continue;
            const group = groups.find(g => pair.some(ending => g.includes(ending)));
            if (group) group.push(...pair.filter(ending => !group.includes(ending)));
            else groups.push(pair);
        }
    }
    return groups;
}

/**
 * A form's accepted answers with each ending also in the drill's other spellings of
 * it (endingSpellings), so a sentence that writes 好きではなかった accepts the
 * 好きじゃなかった its drill teaches. A respelling is kept only when it is a listed
 * form of the word: the causative-passive's される is no form of 話す (話さされる).
 */
export function formSpellings(accept: string[], word: InflectableWord, endings: string[][]): string[] {
    const respelt = accept.flatMap(form => endings.flatMap(group => group
        .filter(ending => form.endsWith(ending))
        .flatMap(ending => group.filter(other => other !== ending).map(other => form.slice(0, form.length - ending.length) + other))));
    return unique([...accept, ...respelt.filter(form => isFormOfWord(form, word, { loose: false }))]);
}
