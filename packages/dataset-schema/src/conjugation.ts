// Japanese conjugation, both ways, from one rule table: `conjugate` builds the labelled forms a
// word page shows in its Forms table, and `deinflect` walks the same table backwards so a search
// for 食べた finds 食べる, in both apps' search (searchRows.ts, `SEARCH_DEINFLECTOR`).
//
// Shared for search only. gokan-srs's utils/inflection.utils.ts generates unlabelled forms for
// grading and belongs to the exercise engine; the dictionary's Forms table needs the labels and
// both searches the inverse direction, which that module has no use for.

export type ConjugationClass =
    | 'ichidan'
    | 'godan'
    /** 行く: te-form 行って. */
    | 'godan-iku'
    /** 問う, 請う: te-form 問うて. */
    | 'godan-tou'
    /** ある: negative ない. */
    | 'godan-aru'
    | 'suru'
    | 'kuru'
    | 'i-adj'
    /** いい: every other form is built on よ (よくない, よかった). */
    | 'i-adj-ii'
    /** な-adjectives (静か): the word itself, then the copula (静かだ, 静かでした, 静かに). */
    | 'na-adj';

export type FormLabel =
    | 'plain' | 'polite' | 'negative' | 'polite-negative'
    | 'past' | 'polite-past' | 'past-negative' | 'polite-past-negative'
    | 'te' | 'potential' | 'passive' | 'causative' | 'causative-passive'
    | 'volitional' | 'imperative' | 'ba' | 'tara' | 'tai' | 'teiru' | 'teru'
    | 'adverbial' | 'nara';

export const FORM_LABELS: Record<FormLabel, string> = {
    plain: 'Plain',
    polite: 'Polite',
    negative: 'Negative',
    'polite-negative': 'Polite negative',
    past: 'Past',
    'polite-past': 'Polite past',
    'past-negative': 'Past negative',
    'polite-past-negative': 'Polite past negative',
    te: 'Te-form',
    potential: 'Potential',
    passive: 'Passive',
    causative: 'Causative',
    'causative-passive': 'Causative-passive',
    volitional: 'Volitional',
    imperative: 'Imperative',
    ba: 'Conditional (ば)',
    tara: 'Conditional (たら)',
    tai: 'Want to (たい)',
    teiru: 'Progressive (ている)',
    teru: 'Progressive, casual (てる)',
    adverbial: 'Adverbial',
    nara: 'Conditional (なら)',
};

/** Stem-relative endings of one conjugation class; a form a class lacks is absent. */
interface Paradigm {
    /** The dictionary-form ending the stem is left of (る, く, する, 来る, い...). */
    plain: string;
    /** Negative stem (食べ, 書か; empty for ある, whose negative is ない). */
    neg: string;
    /** Masu stem (食べ, 書き). */
    masu: string;
    te: string;
    ta: string;
    potential?: string;
    passive?: string;
    causative?: string;
    volitional?: string;
    imperative?: string;
    ba: string;
}

/** Godan rows by dictionary ending: [a, i, e, o, te, ta]. */
const GODAN_ROWS: Record<string, readonly [string, string, string, string, string, string]> = {
    う: ['わ', 'い', 'え', 'お', 'って', 'った'],
    く: ['か', 'き', 'け', 'こ', 'いて', 'いた'],
    ぐ: ['が', 'ぎ', 'げ', 'ご', 'いで', 'いだ'],
    す: ['さ', 'し', 'せ', 'そ', 'して', 'した'],
    つ: ['た', 'ち', 'て', 'と', 'って', 'った'],
    ぬ: ['な', 'に', 'ね', 'の', 'んで', 'んだ'],
    ぶ: ['ば', 'び', 'べ', 'ぼ', 'んで', 'んだ'],
    む: ['ま', 'み', 'め', 'も', 'んで', 'んだ'],
    る: ['ら', 'り', 'れ', 'ろ', 'って', 'った'],
};

function godan(ending: string, te?: string, ta?: string): Paradigm {
    const [a, i, e, o, rowTe, rowTa] = GODAN_ROWS[ending];
    return {
        plain: ending, neg: a, masu: i, te: te ?? rowTe, ta: ta ?? rowTa,
        potential: `${e}る`, passive: `${a}れる`, causative: `${a}せる`,
        volitional: `${o}う`, imperative: e, ba: `${e}ば`,
    };
}

const ICHIDAN: Paradigm = {
    plain: 'る', neg: '', masu: '', te: 'て', ta: 'た',
    potential: 'られる', passive: 'られる', causative: 'させる',
    volitional: 'よう', imperative: 'ろ', ba: 'れば',
};

const SURU: Paradigm = {
    plain: 'する', neg: 'し', masu: 'し', te: 'して', ta: 'した',
    potential: 'できる', passive: 'される', causative: 'させる',
    volitional: 'しよう', imperative: 'しろ', ba: 'すれば',
};

/** 来る in kanji and in kana: the kanji spelling keeps 来 while its reading changes. */
const KURU_KANJI: Paradigm = {
    plain: '来る', neg: '来', masu: '来', te: '来て', ta: '来た',
    potential: '来られる', passive: '来られる', causative: '来させる',
    volitional: '来よう', imperative: '来い', ba: '来れば',
};
const KURU_KANA: Paradigm = {
    plain: 'くる', neg: 'こ', masu: 'き', te: 'きて', ta: 'きた',
    potential: 'こられる', passive: 'こられる', causative: 'こさせる',
    volitional: 'こよう', imperative: 'こい', ba: 'くれば',
};

/** ある: negative ない (not あらない), and no potential or passive in use. */
const ARU: Paradigm = {
    plain: 'ある', neg: '', masu: 'あり', te: 'あって', ta: 'あった',
    volitional: 'あろう', imperative: 'あれ', ba: 'あれば',
};

/** I-adjectives conjugate on the stem left of い; `masu` is unused (polite adds です). */
const I_ADJ: Paradigm = { plain: 'い', neg: 'く', masu: '', te: 'くて', ta: 'かった', ba: 'ければ' };
const II: Paradigm = { plain: 'いい', neg: 'よく', masu: '', te: 'よくて', ta: 'よかった', ba: 'よければ' };

/** Every class, in a fixed order: the search index stores a word's class as its position here, so a new one goes last. */
export const WORD_CLASSES: readonly ConjugationClass[] = [
    'ichidan', 'godan', 'godan-iku', 'godan-tou', 'godan-aru', 'suru', 'kuru', 'i-adj', 'i-adj-ii', 'na-adj',
];

/** A paradigm's forms: the dictionary ending the stem is left of, and every form as a stem-relative ending, in Forms-table order. */
interface FormTable {
    plain: string;
    endings: readonly (readonly [FormLabel, string])[];
}

/** I-adjectives' adverbial form is their negative stem: 高く, よく. */
const adjectiveTable = (p: Paradigm): FormTable => ({
    plain: p.plain,
    endings: [
        ['plain', p.plain], ['polite', `${p.plain}です`],
        ['negative', `${p.neg}ない`], ['polite-negative', `${p.neg}ないです`],
        ['past', p.ta], ['polite-past', `${p.ta}です`],
        ['past-negative', `${p.neg}なかった`], ['polite-past-negative', `${p.neg}なかったです`],
        ['te', p.te], ['adverbial', p.neg], ['ba', p.ba], ['tara', `${p.ta}ら`],
    ],
});

/**
 * な-adjectives: the dictionary form is the stem itself (静か), every form the copula after it.
 * Its plain present is 静かだ, so the Forms table's Present row reads as a sentence's predicate.
 */
const NA_ADJ: FormTable = {
    plain: '',
    endings: [
        ['plain', 'だ'], ['polite', 'です'],
        ['negative', 'じゃない'], ['polite-negative', 'ではありません'],
        ['past', 'だった'], ['polite-past', 'でした'],
        ['past-negative', 'じゃなかった'], ['polite-past-negative', 'ではありませんでした'],
        ['te', 'で'], ['adverbial', 'に'], ['nara', 'なら'],
    ],
};

const verbTable = (p: Paradigm): FormTable => ({ plain: p.plain, endings: verbEndings(p) });

/** Every paradigm of a class, keyed so `deinflect` can try them all. */
const PARADIGMS: Record<ConjugationClass, FormTable[]> = {
    ichidan: [verbTable(ICHIDAN)],
    godan: Object.keys(GODAN_ROWS).map(ending => verbTable(godan(ending))),
    'godan-iku': [verbTable(godan('く', 'って', 'った'))],
    'godan-tou': [verbTable(godan('う', 'うて', 'うた'))],
    'godan-aru': [verbTable(ARU)],
    suru: [verbTable(SURU)],
    kuru: [verbTable(KURU_KANJI), verbTable(KURU_KANA)],
    'i-adj': [adjectiveTable(I_ADJ)],
    'i-adj-ii': [adjectiveTable(II)],
    'na-adj': [NA_ADJ],
};

/** Classes whose dictionary form can be the whole word (する, くる, ある, いい). */
const BARE_CLASSES: ReadonlySet<ConjugationClass> = new Set(['suru', 'kuru', 'godan-aru', 'i-adj-ii']);

/** Whether a class is an adjective's: its Forms table has no potential, passive, causative, volitional or imperative. */
export const isAdjectiveClass = (wordClass: ConjugationClass): boolean => wordClass === 'i-adj' || wordClass === 'i-adj-ii' || wordClass === 'na-adj';

/** A verb paradigm's forms as stem-relative endings, in Forms-table order. */
function verbEndings(p: Paradigm): [FormLabel, string][] {
    const list: [FormLabel, string | undefined][] = [
        ['plain', p.plain], ['polite', `${p.masu}ます`],
        ['negative', `${p.neg}ない`], ['polite-negative', `${p.masu}ません`],
        ['past', p.ta], ['polite-past', `${p.masu}ました`],
        ['past-negative', `${p.neg}なかった`], ['polite-past-negative', `${p.masu}ませんでした`],
        ['te', p.te], ['potential', p.potential], ['passive', p.passive], ['causative', p.causative],
        ['causative-passive', p.causative && `${p.causative.slice(0, -1)}られる`],
        ['volitional', p.volitional], ['imperative', p.imperative],
        ['ba', p.ba], ['tara', `${p.ta}ら`], ['tai', `${p.masu}たい`],
        ['teiru', `${p.te}いる`], ['teru', `${p.te}る`],
    ];
    return list.filter((entry): entry is [FormLabel, string] => entry[1] !== undefined);
}

/**
 * The class a derived form conjugates as: 食べられる is an ichidan verb and 食べたい an
 * i-adjective, so 食べられなかった deinflects in two steps.
 */
const DERIVED_CLASS: Partial<Record<FormLabel, ConjugationClass>> = {
    potential: 'ichidan',
    passive: 'ichidan',
    causative: 'ichidan',
    'causative-passive': 'ichidan',
    teiru: 'ichidan',
    tai: 'i-adj',
    negative: 'i-adj',
};

const VERB_POS: Record<string, ConjugationClass> = {
    v1: 'ichidan',
    'v1-s': 'ichidan',
    'v5k-s': 'godan-iku',
    'v5u-s': 'godan-tou',
    'v5r-i': 'godan-aru',
    v5b: 'godan', v5g: 'godan', v5k: 'godan', v5m: 'godan', v5n: 'godan',
    v5r: 'godan', v5s: 'godan', v5t: 'godan', v5u: 'godan',
    'vs-i': 'suru',
    'vs-s': 'suru',
    vk: 'kuru',
    'adj-i': 'i-adj',
    'adj-ix': 'i-adj-ii',
    'adj-na': 'na-adj',
};

/**
 * A word's conjugation class from its JMdict part-of-speech tags, or null when it does not
 * conjugate this way (nouns, archaic classes). The first conjugating tag wins, so a word tagged
 * noun and な-adjective (自由) is a な-adjective.
 */
export function wordClassOf(pos: readonly string[]): ConjugationClass | null {
    for (const tag of pos) {
        const wordClass = VERB_POS[tag];
        if (wordClass) return wordClass;
    }
    return null;
}

/** The paradigm `word` conjugates by: the one whose dictionary ending it carries. */
function paradigmFor(word: string, wordClass: ConjugationClass): FormTable | null {
    // A kanji いい (良い) conjugates as a plain i-adjective on 良.
    if (wordClass === 'i-adj-ii' && !word.endsWith('いい')) return paradigmFor(word, 'i-adj');
    return PARADIGMS[wordClass].find(p => word.endsWith(p.plain)) ?? null;
}

export interface ConjugatedForm {
    label: FormLabel;
    form: string;
}

/** Every form of `word` in its class, plain first; [] when `word` does not fit the class. */
export function conjugate(word: string, wordClass: ConjugationClass): ConjugatedForm[] {
    const paradigm = paradigmFor(word, wordClass);
    if (!paradigm) return [];
    const stem = word.slice(0, word.length - paradigm.plain.length);
    return paradigm.endings.map(([label, ending]) => ({ label, form: stem + ending }));
}

/**
 * The class a word page's Forms table conjugates `word` by: its tags' class, only when the word
 * fits it, so a verb listed under an odd spelling gets no table rather than a wrong one.
 */
export function formsClassOf(word: string, pos: readonly string[]): ConjugationClass | null {
    const found = wordClassOf(pos);
    return found && conjugate(word, found).length > 0 ? found : null;
}

interface Rule {
    /** The inflected ending, replaced by `plain` to get the dictionary form back. */
    inflected: string;
    plain: string;
    label: FormLabel;
    wordClass: ConjugationClass;
}

const RULES: Rule[] = WORD_CLASSES.flatMap(wordClass =>
    PARADIGMS[wordClass].flatMap(paradigm =>
        paradigm.endings
            // The dictionary form itself is no rule; a な-adjective's plain 静かだ is one.
            .filter(([, inflected]) => inflected !== paradigm.plain)
            .map(([label, inflected]) => ({ inflected, plain: paradigm.plain, label, wordClass })),
    ),
);

export interface Deinflection {
    /** A candidate dictionary form. */
    form: string;
    /** The class the dictionary word must have for this reading to hold. */
    wordClass: ConjugationClass;
    /** The outermost form the query was read as (past, for 食べられた). */
    label: FormLabel;
}

function applyRules(text: string): { form: string; rule: Rule }[] {
    const results: { form: string; rule: Rule }[] = [];
    for (const rule of RULES) {
        if (!text.endsWith(rule.inflected)) continue;
        const stem = text.slice(0, text.length - rule.inflected.length);
        if (!stem && !BARE_CLASSES.has(rule.wordClass)) continue;
        results.push({ form: stem + rule.plain, rule });
    }
    return results;
}

/**
 * Candidate dictionary forms of `text`, each with the class its word must have. Up to two
 * steps, the second only through a derived form's own class (食べられなかった: past negative
 * of the ichidan 食べられる, which is the potential of 食べる). Candidates are not checked
 * against a dictionary here; the caller keeps those that are words of the stated class.
 */
export function deinflect(text: string): Deinflection[] {
    const seen = new Set<string>();
    const results: Deinflection[] = [];
    const add = (form: string, wordClass: ConjugationClass, label: FormLabel) => {
        const key = `${form}|${wordClass}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ form, wordClass, label });
    };

    for (const first of applyRules(text)) {
        add(first.form, first.rule.wordClass, first.rule.label);
        for (const second of applyRules(first.form)) {
            if (DERIVED_CLASS[second.rule.label] !== first.rule.wordClass) continue;
            add(second.form, second.rule.wordClass, first.rule.label);
        }
    }
    return results;
}
