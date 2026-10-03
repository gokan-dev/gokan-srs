import { matchPath } from 'react-router-dom';

export type SessionActivity = 'vocab' | 'grammar';

/**
 * What a route means for a study session:
 * - `activity`: the session's own page (`/quiz`, `/grammar`).
 * - `consult`: a page the learner opens to look something up and come back from
 *   (a word, kanji, grammar point or grammar family). The session is paused, not ended.
 * - `leave`: everything else. The session ends, as it always has.
 *
 * Decided by the destination alone, never by the link that was followed, so the
 * revealed-answer link, the history ticker, a chip inside a detail page and the
 * header search all pause a session the same way.
 */
export type SessionRouteRole = 'activity' | 'consult' | 'leave';

const ACTIVITY_PATH: Record<SessionActivity, string> = {
    vocab: '/quiz',
    grammar: '/grammar',
};

const CONSULT_PATTERNS = [
    '/vocab/:vocabId',
    '/kanji/:character',
    '/grammar/family/:familyId',
    '/grammar/:grammarId',
];

/**
 * Segments under /grammar that are list pages, not grammar points. They match the
 * `/grammar/:grammarId` pattern (App.tsx relies on route order to tell them apart),
 * so they are excluded here explicitly.
 */
const GRAMMAR_LIST_SEGMENTS = new Set(['browse', 'chapters', 'family']);

export function sessionRouteRole(pathname: string, activity: SessionActivity): SessionRouteRole {
    if (pathname === ACTIVITY_PATH[activity]) return 'activity';

    for (const pattern of CONSULT_PATTERNS) {
        const match = matchPath(pattern, pathname);
        if (!match) continue;
        if (pattern === '/grammar/:grammarId' && GRAMMAR_LIST_SEGMENTS.has(match.params.grammarId ?? '')) continue;
        return 'consult';
    }
    return 'leave';
}

/** The page a paused session returns to. */
export function sessionActivityPath(activity: SessionActivity): string {
    return ACTIVITY_PATH[activity];
}
