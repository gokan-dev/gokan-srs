/** Kana, kanji, CJK punctuation and full-width forms: what only a Japanese face draws. */
const JAPANESE = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF]+/g;

/** A stretch of text, Japanese or not. */
export interface TextRun {
    text: string;
    japanese: boolean;
}

/**
 * Splits text that mixes English and Japanese (a lesson title, "から / ので", "Using
 * ば vs たら", a synonym's nuance line) into runs, so each Japanese one can be set in a Japanese
 * face: an English face such as the page title's Source Serif 4 has no CJK glyphs. Both apps:
 * gokan-srs's MixedText, the dictionary's nuance lines (each run its own `lang="ja"` span).
 */
export function japaneseRuns(text: string): TextRun[] {
    const runs: TextRun[] = [];
    let last = 0;
    for (const m of text.matchAll(JAPANESE)) {
        if (m.index > last) runs.push({ text: text.slice(last, m.index), japanese: false });
        runs.push({ text: m[0], japanese: true });
        last = m.index + m[0].length;
    }
    if (last < text.length) runs.push({ text: text.slice(last), japanese: false });
    return runs;
}
