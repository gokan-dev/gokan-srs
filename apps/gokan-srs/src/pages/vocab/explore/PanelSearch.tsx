import type { ReactNode } from "react";
import { SearchField } from "../../../components/ui/SearchField";

interface PanelSearchProps {
    text: string;
    onChange: (text: string) => void;
    label: string;
    placeholder: string;
    /** "1,030 sentences", "15 of 1,030 match "eat"" (resultCountLine): announced as it changes. */
    countLine: string;
    /** A control at the count line's right ("Shortest first"). */
    aside?: ReactNode;
}

/**
 * The top of an Explore panel: one search field and nothing else, then the result count. Only the
 * results under it redraw as the learner types, so the field keeps its focus.
 */
export function PanelSearch({ text, onChange, label, placeholder, countLine, aside }: PanelSearchProps) {
    return (
        <div className="space-y-3 mb-4">
            <SearchField value={text} onChange={onChange} label={label} placeholder={placeholder} />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="type-meta tabular-nums" aria-live="polite">{countLine}</p>
                {aside}
            </div>
        </div>
    );
}
