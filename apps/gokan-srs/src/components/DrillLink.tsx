import { Link } from "react-router-dom";
import { hasDrill } from "../context/quiz/drillSelectors";
import type { DrillSet } from "../models/grammar.model";
import { useAsyncData } from "../hooks/useAsyncData";
import { drillPath } from "../utils/navigation.utils";
import { buttonClassName } from "./ui/buttonStyles";

/**
 * The way into a contrast drill (issue #249), on a lesson, a family, a chapter or a
 * point. Shown only once the drill is known to have cards (hasDrill, which stops at
 * the first two points with one): most sets have no sentence the dataset rules a
 * sibling out of yet, and a button to an empty drill says the feature is broken.
 */
/** `className`: its spacing where it sits, on the link itself, so a set with no drill leaves no gap. */
export function DrillLink({ set, label, className = "" }: { set: DrillSet; label: string; className?: string }) {
    const path = drillPath(set);
    const available = useAsyncData(path, () => hasDrill(set));
    if (!available.data) return null;
    return (
        <Link to={path} className={buttonClassName("secondary", "sm", `w-fit ${className}`)}>
            {label}
        </Link>
    );
}
