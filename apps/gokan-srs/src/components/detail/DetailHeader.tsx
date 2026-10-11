import type { ReactNode } from "react";
import { BackLink } from "../BackLink";

interface DetailHeaderProps {
    parentPath: string;
    /** The subject itself: the word, the kanji, the grammar point's title. */
    title: ReactNode;
    /** Readings, romaji, other spellings: under the title. */
    children?: ReactNode;
    /** Neutral chips (JLPT, register). */
    chips?: ReactNode;
    /** The learner's relation to the subject: "Learn this word", or its status and rings. */
    actions?: ReactNode;
}

/**
 * The identity block of a vocab, kanji or grammar page, not inside a card: the
 * subject as the title (never a generic "Vocabulary Details"), what names it,
 * its chips, and on the right (below it on a phone) the main action, so that
 * action is on the first screen.
 */
export function DetailHeader({ parentPath, title, children, chips, actions }: DetailHeaderProps) {
    return (
        <header className="w-full mb-10">
            <BackLink parentPath={parentPath} />
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="min-w-0">
                    <h1 className="break-words">{title}</h1>
                    {children && <div className="mt-2 space-y-1">{children}</div>}
                    {chips && <div className="flex flex-wrap items-center gap-2 mt-3">{chips}</div>}
                </div>
                {actions && <div className="md:shrink-0 md:max-w-xs">{actions}</div>}
            </div>
        </header>
    );
}
