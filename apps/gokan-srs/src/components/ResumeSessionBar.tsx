import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQuiz } from "../context/useQuiz";
import { sessionActivityPath, sessionRouteRole } from "../context/quiz/sessionRoutes";
import type { SessionActivity } from "../context/quiz/sessionRoutes";

const ACTIVITY_NOUN: Record<SessionActivity, string> = {
    vocab: 'vocabulary',
    grammar: 'grammar',
};

/**
 * "Back to your session", shown on a consult page (a word, kanji or grammar
 * point's detail page) while a study session is paused there. Without it, a
 * learner who follows a few links has no obvious way back and reaches for the
 * hub, which ends the session.
 *
 * Rendered by App.tsx as its own full-width row in normal flow, directly beneath
 * the app header. Never absolute or fixed: that is how page Back buttons ended up
 * on top of their titles on phones. One line; the label truncates rather than
 * wrapping or pushing the count off the row.
 */
export function ResumeSessionBar() {
    const { state, sessionStats, grammarSessionStats } = useQuiz();
    const { pathname } = useLocation();

    const paused: { activity: SessionActivity; suspendedAt: number; done: number; total: number }[] = [];
    if (state.session?.suspendedAt !== undefined) {
        paused.push({ activity: 'vocab', suspendedAt: state.session.suspendedAt, ...sessionStats });
    }
    if (state.grammarSession?.suspendedAt !== undefined) {
        paused.push({ activity: 'grammar', suspendedAt: state.grammarSession.suspendedAt, ...grammarSessionStats });
    }
    // Only one can be paused in practice (each activity's page ends the other's
    // session); if both are, the most recently paused one is the one to go back to.
    const target = paused
        .filter(p => sessionRouteRole(pathname, p.activity) === 'consult')
        .sort((a, b) => b.suspendedAt - a.suspendedAt)[0];
    if (!target) return null;

    return (
        <div className="w-full px-4 pb-2 md:px-8 md:pb-4">
            <Link
                to={sessionActivityPath(target.activity)}
                className="flex w-full items-center gap-2 min-h-11 px-3 rounded border border-accent/30 bg-accent/5 text-accent font-gothic text-sm hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors md:max-w-5xl md:mx-auto"
            >
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                    Back to your {ACTIVITY_NOUN[target.activity]} session
                </span>
                {target.total > 0 && (
                    <span className="shrink-0 text-secondary tabular-nums">
                        {target.done} / {target.total}
                    </span>
                )}
            </Link>
        </div>
    );
}
