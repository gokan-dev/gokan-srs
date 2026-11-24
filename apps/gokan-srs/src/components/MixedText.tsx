import { japaneseRuns } from "../utils/japaneseRuns.utils";

/**
 * Text that mixes English and Japanese (a lesson title, a contrast case's guidance), each
 * Japanese run in a Japanese face: an English face (the page title's Source Serif 4, Inter)
 * either has no CJK glyphs or draws them only by fallback, with its own metrics around them.
 */
export function MixedText({ text }: { text: string }) {
    return japaneseRuns(text).map((run, i) => (run.japanese
        ? <span key={i} className="font-gothic" lang="ja">{run.text}</span>
        : run.text));
}
