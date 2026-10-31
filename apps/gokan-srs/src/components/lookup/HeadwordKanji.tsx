import { headwordGlyphs } from "../../utils/lookup.utils";
import { LookupText } from "./LookupText";

/**
 * A headword with each of its kanji a lookup trigger (hover, focus, click or tap opens the kanji
 * card), the kana between them plain: a word page's title.
 */
export function HeadwordKanji({ headword, kanji }: { headword: string; kanji: readonly string[] }) {
    return headwordGlyphs(headword, kanji).map((part, i) => part.kanji
        ? (
            <LookupText key={i} target={{ kind: 'kanji', glyph: part.text }} focusable className="cursor-pointer rounded-md hover:text-accent focus-visible:outline-none focus-visible:text-accent transition-colors">
                {part.text}
            </LookupText>
        )
        : <span key={i}>{part.text}</span>);
}
