// Japanese conjugation, both ways, from one rule table: `conjugate` builds the labelled forms a
// word page shows in its Forms table, and `deinflect` walks the same table backwards so a search
// for 食べた finds 食べる.
//
// Dictionary-local on purpose. gokan-srs's utils/inflection.utils.ts generates unlabelled forms
// for grading and belongs to the exercise engine; the dictionary needs the labels and the
// inverse direction, which that module has no use for.

export type WordClass =
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
    | 'i-adj-ii';

export type FormLabel =
    | 'plain' | 'polite' | 'negative' | 'polite-negative'
    | 'past' | 'polite-past' | 'past-negative' | 'polite-past-negative'
    | 'te' | 'potential' | 'passive' | 'causative' | 'causative-passive'
    | 'volitional' | 'imperative' | 'ba' | 'tara' | 'tai' | 'teiru' | 'teru';

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

/** Every paradigm of a class, keyed so `deinflect` can try them all. */
const PARADIGMS: Record<WordClass, Paradigm[]> = {
    ichidan: [ICHIDAN],
    godan: Object.keys(GODAN_ROWS).map(ending => godan(ending)),
    'godan-iku': [godan('く', 'って', 'った')],
    'godan-tou': [godan('う', 'うて', 'うた')],
    'godan-aru': [ARU],
    suru: [SURU],
    kuru: [KURU_KANJI, KURU_KANA],
    'i-adj': [I_ADJ],
    'i-adj-ii': [II],
};

/** Classes whose dictionary form can be the whole word (する, くる, ある, いい). */
const BARE_CLASSES: ReadonlySet<WordClass> = new Set(['suru', 'kuru', 'godan-aru', 'i-adj-ii']);

const isAdjective = (wordClass: WordClass) => wordClass === 'i-adj' || wordClass === 'i-adj-ii';

/** The forms of a paradigm as stem-relative endings, in Forms-table order. */
function endings(p: Paradigm, adjective: boolean): [FormLabel, string][] {
    if (adjective) {
        return [
            ['plain', p.plain], ['polite', `${p.plain}です`],
            ['negative', `${p.neg}ない`], ['polite-negative', `${p.neg}ないです`],
            ['past', p.ta], ['polite-past', `${p.ta}です`],
            ['past-negative', `${p.neg}なかった`], ['polite-past-negative', `${p.neg}なかったです`],
            ['te', p.te], ['ba', p.ba], ['tara', `${p.ta}ら`],
        ];
    }
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
const DERIVED_CLASS: Partial<Record<FormLabel, WordClass>> = {
    potential: 'ichidan',
    passive: 'ichidan',
    causative: 'ichidan',
    'causative-passive': 'ichidan',
    teiru: 'ichidan',
    tai: 'i-adj',
    negative: 'i-adj',
};

const VERB_POS: Record<string, WordClass> = {
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
};

/**
 * A word's conjugation class from its JMdict part-of-speech tags, or null when it does not
 * conjugate this way (nouns, な-adjectives, archaic classes). The first conjugating tag wins.
 */
export function wordClassOf(pos: readonly string[]): WordClass | null {
    for (const tag of pos) {
        const wordClass = VERB_POS[tag];
        if (wordClass) return wordClass;
    }
    return null;
}

/** The paradigm `word` conjugates by: the one whose dictionary ending it carries. */
function paradigmFor(word: string, wordClass: WordClass): Paradigm | null {
    // A kanji いい (良い) conjugates as a plain i-adjective on 良.
    if (wordClass === 'i-adj-ii' && !word.endsWith('いい')) return paradigmFor(word, 'i-adj');
    return PARADIGMS[wordClass].find(p => word.endsWith(p.plain)) ?? null;
}

export interface ConjugatedForm {
    label: FormLabel;
    form: string;
}

/** Every form of `word` in its class, plain first; [] when `word` does not fit the class. */
export function conjugate(word: string, wordClass: WordClass): ConjugatedForm[] {
    const paradigm = paradigmFor(word, wordClass);
    if (!paradigm) return [];
    const stem = word.slice(0, word.length - paradigm.plain.length);
    return endings(paradigm, isAdjective(wordClass)).map(([label, ending]) => ({ label, form: stem + ending }));
}

interface Rule {
    /** The inflected ending, replaced by `plain` to get the dictionary form back. */
    inflected: string;
    plain: string;
    label: FormLabel;
    wordClass: WordClass;
}

const RULES: Rule[] = (Object.keys(PARADIGMS) as WordClass[]).flatMap(wordClass =>
    PARADIGMS[wordClass].flatMap(paradigm =>
        endings(paradigm, isAdjective(wordClass))
            .filter(([label]) => label !== 'plain')
            .map(([label, inflected]) => ({ inflected, plain: paradigm.plain, label, wordClass })),
    ),
);

export interface Deinflection {
    /** A candidate dictionary form. */
    form: string;
    /** The class the dictionary word must have for this reading to hold. */
    wordClass: WordClass;
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
    const add = (form: string, wordClass: WordClass, label: FormLabel) => {
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
