import { Link } from "react-router-dom";
import { loadDrill } from "../context/quiz/drillSelectors";
import type { DrillSet } from "../context/quiz/drillSelectors";
import { useAsyncData } from "../hooks/useAsyncData";
import { drillPath } from "../utils/navigation.utils";
import { buttonClassName } from "./ui/buttonStyles";

/**
 * The way into a contrast drill (issue #249), on a lesson, a family, a chapter or a
 * point. Shown only once the drill is known to have cards: most sets have no sentence
 * the dataset rules a sibling out of yet, and a button to an empty drill says the
 * feature is broken.
 */
export function DrillLink({ set, label }: { set: DrillSet; label: string }) {
    const path = drillPath(set);
    const drill = useAsyncData(path, () => loadDrill(set, 'availability'));
    if (!drill.data) return null;
    return (
        <Link to={path} className={buttonClassName("secondary", "sm", "w-fit")}>
            {label}
        </Link>
    );
}
