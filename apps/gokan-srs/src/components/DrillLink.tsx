import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { hasDrill } from "../context/quiz/drillSelectors";
import type { DrillSet } from "../models/grammar.model";
import { useAsyncData } from "../hooks/useAsyncData";
import { drillPath } from "../utils/navigation.utils";
import { buttonClassName } from "./ui/buttonStyles";

/**
 * The way into a contrast drill (issue #249), on a lesson, a family, a chapter or a
 * point. Shown only once the drill is known to have cards (hasDrill, which stops at
 * the first point with one): a button to an empty drill says the feature is broken.
 * `fallback` is what a set with no drill shows once that is known (a lesson's "No drill
 * yet", so a missing button is never a mystery); nothing while it loads.
 * `className`: its spacing where it sits, on the link itself, so a set with no drill leaves no gap.
 * `text`: written as a small text link (a chapter browser row's "Drill"), not a button. Its
 * short label is the same on every row, so it is named for its point (`name`, the header's
 * wording): a screen reader's list of links tells the drills apart.
 */
export function DrillLink({ set, label, className = "", fallback = null, ...variant }: { set: DrillSet; label: string; className?: string; fallback?: ReactNode } & ({ text?: false } | { text: true; name: string })) {
    const text = variant.text === true;
    const path = drillPath(set);
    const available = useAsyncData(path, () => hasDrill(set));
    if (available.status === 'ready' && !available.data) return fallback;
    if (!available.data) return null;
    return (
        <Link
            to={path}
            aria-label={variant.text ? variant.name : undefined}
            className={text
                // 44px tall on phones, as every small action (PlayButton), 32px from md.
                ? `inline-flex items-center min-h-11 md:min-h-8 px-2 font-sans text-sm text-accent hover:underline ${className}`
                : buttonClassName("secondary", "touch", `w-fit ${className}`)}
        >
            {label}
        </Link>
    );
}
