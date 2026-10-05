import { Link } from "react-router-dom";

/**
 * The route to the grammar point's detail page, available only AFTER answering.
 *
 * Before answering it is a spoiler route: the detail page carries the point's
 * formation and every example sentence, which is the answer. The JLPT chip used
 * to be a link unconditionally, so it was reachable mid-question by anyone who
 * thought to click it.
 *
 * After answering the opposite is true - checking the point is exactly what a
 * learner wants to do with a form they just got wrong - so it becomes an
 * explicit labelled link rather than a chip you have to guess is clickable.
 */
export function PointLink({ pointId, revealed }: { pointId: string; revealed: boolean }) {
    if (!revealed) return null;
    return (
        <Link
            to={`/grammar/${pointId}`}
            className="text-xs font-gothic text-accent hover:underline whitespace-nowrap"
        >
            View grammar point
        </Link>
    );
}
