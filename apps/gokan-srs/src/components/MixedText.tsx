import { japaneseRuns } from "../utils/japaneseRuns.utils";

/**
 * Text that mixes English and Japanese (a lesson title, a contrast case's guidance), each
 * Japanese run in a Japanese face: an English face (the page title's Source Serif 4, Inter)
 * either has no CJK glyphs or draws them only by fallback, with its own metrics around them.
 * `unbroken`: each Japanese run stays on one line (a synonym's nuance line in a list row names
 * words and short phrases, 帽子を取る, which a wrap would split); for short runs only.
 */
export function MixedText({ text, unbroken = false }: { text: string; unbroken?: boolean }) {
    return japaneseRuns(text).map((run, i) => (run.japanese
        ? <span key={i} className={unbroken ? 'font-gothic whitespace-nowrap' : 'font-gothic'} lang="ja">{run.text}</span>
        : run.text));
}
