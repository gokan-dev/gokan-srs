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
    /** The learner's relation to the subject: "Learn this word", or its status and next review. */
    actions?: ReactNode;
}

/**
 * The identity block of a vocab, kanji or grammar page, not inside a card: the
 * subject as the title (never a generic "Vocabulary Details"), what names it,
 * its chips, and the main action, so that action is on the first screen. From
 * `lg` it sits on the body's 8/4 grid, so the action starts on the side
 * column's left edge; below it, the action follows the readings.
 */
export function DetailHeader({ parentPath, title, children, chips, actions }: DetailHeaderProps) {
    return (
        <header className="w-full mb-10">
            <BackLink parentPath={parentPath} />
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start">
                <div className="min-w-0 lg:col-span-8">
                    <h1 className="break-words">{title}</h1>
                    {children && <div className="mt-2 space-y-1">{children}</div>}
                    {chips && <div className="flex flex-wrap items-center gap-2 mt-3">{chips}</div>}
                </div>
                {actions && <div className="min-w-0 lg:col-span-4">{actions}</div>}
            </div>
        </header>
    );
}
