import type { Vocabulary } from '../models/vocabulary.model';
import { hasKanji, isKanaOnly, kanjiSkeleton } from './kanji.utils';

/**
 * How a word inflects, from its JMdict part-of-speech tags.
 *
 * A word can carry several (心配 is both a な-adjective and a する-noun), and
 * every applicable class contributes forms: 心配だ and 心配した are both forms of
 * 心配, so answering either must count as the right word.
 */
export type WordClass =
    | 'godan' | 'godan-iku' | 'godan-aru' | 'godan-aru-honorific'
    | 'ichidan' | 'kuru' | 'suru' | 'suru-s' | 'suru-noun'
    | 'i-adj' | 'ii' | 'na-adj';

/** The minimal shape the generator needs, small enough to carry on a quiz plan. */
export interface InflectableWord {
    /** Written forms (kanji first, then alternatives). */
    written: string[];
    /** Readings (primary first, then alternatives). */
    readings: string[];
    classes: WordClass[];
}

export interface InflectedForm {
    written: string;
    kana: string;
}

const GODAN_TAGS: Record<string, WordClass> = {
    'v5u': 'godan', 'v5u-s': 'godan', 'v5k': 'godan', 'v5k-s': 'godan-iku', 'v5g': 'godan',
    'v5s': 'godan', 'v5t': 'godan', 'v5n': 'godan', 'v5b': 'godan', 'v5m': 'godan',
    'v5r': 'godan', 'v5r-i': 'godan-aru', 'v5aru': 'godan-aru-honorific',
};

/** Every inflection class the word's senses declare. Empty for a word that does not inflect. */
export function wordClassesOf(vocab: Partial<Pick<Vocabulary, 'senses'>>): WordClass[] {
    const classes = new Set<WordClass>();
    for (const sense of vocab.senses ?? []) {
        for (const tag of sense.pos ?? []) {
            if (GODAN_TAGS[tag]) classes.add(GODAN_TAGS[tag]);
            else if (tag === 'v1' || tag === 'v1-s') classes.add('ichidan');
            else if (tag === 'vk') classes.add('kuru');
            else if (tag === 'vs-i') classes.add('suru');
            // 愛する (vs-s) conjugates partly as a godan す verb (愛さない) and partly
            // as する (愛します); offering both is the lenient, correct reading.
            else if (tag === 'vs-s') classes.add('suru-s');
            else if (tag === 'vs') classes.add('suru-noun');
            else if (tag === 'adj-i') classes.add('i-adj');
            else if (tag === 'adj-ix') classes.add('ii');
            else if (tag === 'adj-na') classes.add('na-adj');
        }
    }
    return [...classes];
}

export function toInflectableWord(vocab: Pick<Vocabulary, 'writtenForm' | 'reading'> & Partial<Pick<Vocabulary, 'senses'>>): InflectableWord {
    return {
        written: [vocab.writtenForm.kanji, ...(vocab.writtenForm.alternatives ?? [])].filter(Boolean),
        readings: [vocab.reading.primary, ...(vocab.reading.alternatives ?? [])].filter(Boolean),
        classes: wordClassesOf(vocab),
    };
}

/* ---------- suffix tables (kana appended to a stem) ---------- */

const NEGATIVE = ['ない', 'なかった', 'なくて', 'ないで', 'なければ', 'なきゃ', 'ないです', 'なかったです'];
const MASU = ['ます', 'ました', 'ません', 'ませんでした', 'ましょう', 'ませんか', '', 'ながら', 'たい', 'たくない', 'たかった', 'たくて', 'たくなかった', 'たいです'];

/** The て-form and everything built directly on it. `te` ends in て or で. */
function teFamily(te: string): string[] {
    const voiced = te.endsWith('で');
    const base = te.slice(0, -1);
    const ta = base + (voiced ? 'だ' : 'た');
    return [
        te, ta, ta + 'ら', ta + 'り', ta + 'ろう',
        te + 'いる', te + 'いた', te + 'います', te + 'いました', te + 'いない', te + 'いなかった',
        te + 'る', te + 'た', te + 'ない',
        te + 'おく', te + 'おいた', base + (voiced ? 'どく' : 'とく'),
        te + 'しまう', te + 'しまった', base + (voiced ? 'じゃう' : 'ちゃう'), base + (voiced ? 'じゃった' : 'ちゃった'),
        te + 'ください', te + 'も', te + 'は',
    ];
}

/** An ichidan verb's forms off its stem (食べ). `derive` adds potential/passive/causative, each expanded once. */
function ichidanSuffixes(derive: boolean): string[] {
    const base = [
        'る', 'るな', 'れば', 'よう', 'ろ', 'よ', 'ず', 'ずに',
        ...NEGATIVE, ...MASU, ...teFamily('て'),
    ];
    if (!derive) return base;
    const derived = ['られ', 'れ', 'させ', 'させられ']
        .flatMap(d => ichidanSuffixes(false).map(s => d + s));
    return [...base, ...derived];
}

const GODAN_ROWS: Record<string, { a: string; i: string; e: string; o: string; te: string }> = {
    'う': { a: 'わ', i: 'い', e: 'え', o: 'お', te: 'って' },
    'く': { a: 'か', i: 'き', e: 'け', o: 'こ', te: 'いて' },
    'ぐ': { a: 'が', i: 'ぎ', e: 'げ', o: 'ご', te: 'いで' },
    'す': { a: 'さ', i: 'し', e: 'せ', o: 'そ', te: 'して' },
    'つ': { a: 'た', i: 'ち', e: 'て', o: 'と', te: 'って' },
    'ぬ': { a: 'な', i: 'に', e: 'ね', o: 'の', te: 'んで' },
    'ぶ': { a: 'ば', i: 'び', e: 'べ', o: 'ぼ', te: 'んで' },
    'む': { a: 'ま', i: 'み', e: 'め', o: 'も', te: 'んで' },
    'る': { a: 'ら', i: 'り', e: 'れ', o: 'ろ', te: 'って' },
};

/** A godan verb's suffixes off its stem (書く → 書), or null when the ending does not fit the class. */
function godanSuffixes(ending: string, cls: WordClass): string[] | null {
    const row = GODAN_ROWS[ending];
    if (!row) return null;
    const te = cls === 'godan-iku' ? 'って' : row.te;
    const i = cls === 'godan-aru-honorific' ? 'い' : row.i;
    const imperative = cls === 'godan-aru-honorific' ? 'い' : row.e;

    const out = [
        ending, ending + 'な',
        i, ...MASU.map(s => i + s),
        row.e + 'ば', imperative, row.o + 'う',
        ...teFamily(te),
        // Potential (書ける), passive (書かれる), causative (書かせる) and
        // causative-passive (書かせられる / 書かされる) are ichidan verbs.
        ...ichidanSuffixes(false).map(s => row.e + s),
        ...ichidanSuffixes(false).map(s => row.a + 'れ' + s),
        ...ichidanSuffixes(false).map(s => row.a + 'せ' + s),
        ...ichidanSuffixes(false).map(s => row.a + 'せられ' + s),
        ...(ending !== 'す' ? ichidanSuffixes(false).map(s => row.a + 'され' + s) : []),
        row.a + 'ず', row.a + 'ずに',
    ];
    // ある's negative is ない, never あらない.
    if (cls !== 'godan-aru') out.push(...NEGATIVE.map(s => row.a + s));
    return out;
}

const SURU_SUFFIXES = [
    'する', 'するな', 'すれば', 'しよう', 'しろ', 'せよ', 'せず', 'せずに',
    ...NEGATIVE.map(s => 'し' + s), ...MASU.map(s => 'し' + s), 'し',
    ...teFamily('して'),
    ...ichidanSuffixes(false).map(s => 'され' + s),
    ...ichidanSuffixes(false).map(s => 'させ' + s),
    ...ichidanSuffixes(false).map(s => 'させられ' + s),
    ...ichidanSuffixes(false).map(s => 'でき' + s),
];

const I_ADJ_SUFFIXES = [
    'い', 'いです', 'く', 'くて', 'かった', 'かったです', 'くない', 'くないです', 'くなかった', 'くなかったです',
    'くなくて', 'くありません', 'くありませんでした', 'ければ', 'くなければ', 'かろう', 'かろ', 'さ', 'そう', 'すぎる', 'すぎた',
    'くなる', 'くなった', 'くする', 'かったら', 'くても',
];

const NA_ADJ_SUFFIXES = [
    '', 'だ', 'な', 'に', 'で', 'です', 'だった', 'でした', 'だろう', 'でしょう', 'なら', 'だったら',
    'じゃない', 'ではない', 'じゃなかった', 'ではなかった', 'じゃなくて', 'ではなくて',
    'じゃないです', 'じゃなかったです', 'じゃありません', 'ではありません', 'じゃありませんでした', 'ではありませんでした',
    'さ', 'そう', 'すぎる', 'になる', 'になった', 'にする',
];

/** Pairs `written stem + suffix` with `kana stem + suffix` for every suffix. */
function attach(wStem: string, kStem: string, suffixes: string[]): InflectedForm[] {
    return suffixes.map(s => ({ written: wStem + s, kana: kStem + s }));
}

/** Forms of one (written, reading) pair under one class. Empty when the pair does not fit the class. */
function formsFor(w: string, k: string, cls: WordClass): InflectedForm[] {
    switch (cls) {
        case 'godan':
        case 'godan-iku':
        case 'godan-aru':
        case 'godan-aru-honorific': {
            const ending = k.slice(-1);
            if (w.slice(-1) !== ending) return [];
            const suffixes = godanSuffixes(ending, cls);
            if (!suffixes) return [];
            const out = attach(w.slice(0, -1), k.slice(0, -1), suffixes);
            // ある (有る): the negative drops the verb entirely.
            if (cls === 'godan-aru') out.push(...NEGATIVE.map(s => ({ written: s, kana: s })));
            return out;
        }
        case 'ichidan':
            if (!w.endsWith('る') || !k.endsWith('る')) return [];
            return attach(w.slice(0, -1), k.slice(0, -1), ichidanSuffixes(true));
        case 'kuru': {
            const wPrefix = w.endsWith('来る') ? w.slice(0, -2) : w.endsWith('くる') ? w.slice(0, -2) : null;
            if (wPrefix === null || !k.endsWith('くる')) return [];
            const kPrefix = k.slice(0, -2);
            const usesKanji = w.endsWith('来る');
            // The kanji stays 来 while its reading moves between こ, き and く.
            const stem = (kana: string) => ({ w: wPrefix + (usesKanji ? '来' : kana), k: kPrefix + kana });
            const ko = stem('こ'), ki = stem('き'), ku = stem('く');
            return [
                ...attach(ku.w, ku.k, ['る', 'るな', 'れば']),
                ...attach(ko.w, ko.k, [
                    ...NEGATIVE, 'よう', 'い', 'ず', 'ずに',
                    ...ichidanSuffixes(false).map(s => 'られ' + s),
                    ...ichidanSuffixes(false).map(s => 'れ' + s),
                    ...ichidanSuffixes(false).map(s => 'させ' + s),
                    ...ichidanSuffixes(false).map(s => 'させられ' + s),
                ]),
                ...attach(ki.w, ki.k, [...MASU, ...teFamily('て')]),
            ];
        }
        case 'suru': {
            if (!w.endsWith('する') || !k.endsWith('する')) return [];
            return attach(w.slice(0, -2), k.slice(0, -2), SURU_SUFFIXES);
        }
        case 'suru-s': {
            // 愛する: する forms (愛します) plus the godan す verb 愛す (愛さない).
            if (!w.endsWith('する') || !k.endsWith('する')) return [];
            return [
                ...attach(w.slice(0, -2), k.slice(0, -2), SURU_SUFFIXES),
                ...formsFor(w.slice(0, -1), k.slice(0, -1), 'godan'),
            ];
        }
        case 'suru-noun':
            return attach(w, k, SURU_SUFFIXES);
        case 'i-adj':
            if (!w.endsWith('い') || !k.endsWith('い')) return [];
            return attach(w.slice(0, -1), k.slice(0, -1), I_ADJ_SUFFIXES);
        case 'ii': {
            // いい conjugates off よい: よくない, よかった. 良い keeps its kanji.
            if (!k.endsWith('い')) return [];
            const kStem = k === 'いい' ? 'よ' : k.slice(0, -1);
            const wStem = w === 'いい' ? 'よ' : w.endsWith('い') ? w.slice(0, -1) : null;
            if (wStem === null) return [];
            return [
                { written: w, kana: k }, { written: w + 'です', kana: k + 'です' },
                ...attach(wStem, kStem, I_ADJ_SUFFIXES),
            ];
        }
        case 'na-adj':
            return attach(w, k, NA_ADJ_SUFFIXES);
    }
}

/**
 * Every inflected form of the word, each written form paired with its kana. Kana
 * readings also generate kana-only forms, so たべた is produced as a form in its
 * own right and not only as the reading of 食べた.
 */
export function generateInflections(word: InflectableWord): InflectedForm[] {
    if (word.classes.length === 0 || word.readings.length === 0) return [];
    const primary = word.readings[0];
    const sources: Array<[string, string]> = [
        ...word.written.map((w): [string, string] => [w, primary]),
        ...word.readings.map((r): [string, string] => [r, r]),
    ];

    const seen = new Set<string>();
    const out: InflectedForm[] = [];
    for (const [w, k] of sources) {
        for (const cls of word.classes) {
            for (const form of formsFor(w, k, cls)) {
                const key = `${form.written}|${form.kana}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(form);
            }
        }
    }
    return out;
}

/** The kana of an inflected surface (食べたら gives たべたら), or null when the generator does not produce it. */
export function kanaOfSurface(surface: string, word: InflectableWord): string | null {
    const match = generateInflections(word).find(f => f.written === surface);
    return match ? match.kana : null;
}

/** A written form's stem: what stays fixed while the word inflects. */
function writtenStem(w: string, cls: WordClass): string | null {
    switch (cls) {
        case 'godan': case 'godan-iku': case 'godan-aru': case 'godan-aru-honorific':
            return w.slice(0, -1);
        case 'ichidan': return w.endsWith('る') ? w.slice(0, -1) : null;
        case 'kuru': return w.endsWith('来る') ? w.slice(0, -1) : null;
        case 'suru': case 'suru-s': return w.endsWith('する') ? w.slice(0, -2) : null;
        case 'suru-noun': case 'na-adj': return w;
        case 'i-adj': case 'ii': return w.endsWith('い') ? w.slice(0, -1) : null;
    }
}

const normalize = (s: string) => s.trim().replace(/\s+/g, '');

/**
 * True when `input` is SOME form of the word: the dictionary form, any generated
 * inflection, in kanji or in kana.
 *
 * The fallback covers forms the tables do not list (食べさせられなかったら): a
 * kanji answer with the same kanji skeleton that starts with the written stem and
 * continues in kana. It is a prefix test on the STEM, which is what keeps 上げる
 * from passing as a form of 上がる (stem 上が) and 会社 from passing as 会話. A bare
 * stem (書 for 書く) is deliberately not a form: that stays the dropped-okurigana
 * `minor_error` matchAnswer already gives it.
 */
export function isFormOfWord(input: string, word: InflectableWord): boolean {
    const u = normalize(input);
    if (!u) return false;
    if (word.written.includes(u) || word.readings.includes(u)) return true;

    const forms = generateInflections(word);
    if (forms.some(f => f.written === u || f.kana === u)) return true;

    if (!hasKanji(u)) return false;
    for (const w of word.written) {
        if (kanjiSkeleton(w) !== kanjiSkeleton(u)) continue;
        for (const cls of word.classes) {
            const stem = writtenStem(w, cls);
            if (!stem || !hasKanji(stem) || !u.startsWith(stem)) continue;
            const rest = u.slice(stem.length);
            if (rest.length > 0 && isKanaOnly(rest)) return true;
        }
    }
    return false;
}
