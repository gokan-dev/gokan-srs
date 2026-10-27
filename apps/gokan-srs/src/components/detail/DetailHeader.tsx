import type { ReactNode } from "react";
import { BackLink } from "../BackLink";

interface DetailHeaderProps {
    parentPath: string;
    /** The subject itself: the word, the kanji, the grammar point's title. */
    title: ReactNode;
    /** Readings, romaji, other spellings: under the title. */
    children?: ReactNode;
    /** Neutral chips (JLPT, register), and a word's kanji. */
    chips?: ReactNode;
    /** A row of facts under the chips (a word's frequency, KKLC step, textbooks): `dt`/`dd` pairs, laid out here. */
    facts?: ReactNode;
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
export function DetailHeader({ parentPath, title, children, chips, facts, actions }: DetailHeaderProps) {
    return (
        <header className="w-full mb-10">
            <BackLink parentPath={parentPath} />
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start">
                <div className="min-w-0 lg:col-span-8">
                    <h1 className="break-words">{title}</h1>
                    {children && <div className="mt-2 space-y-1">{children}</div>}
                    {chips && <div className="flex flex-wrap items-center gap-2 mt-3">{chips}</div>}
                    {facts && <dl className="flex flex-wrap gap-x-8 gap-y-3 mt-4">{facts}</dl>}
                </div>
                {actions && <div className="min-w-0 lg:col-span-4">{actions}</div>}
            </div>
        </header>
    );
}
