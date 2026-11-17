import { TextButton } from "../ui/TextButton";
import type { PagedPanel } from "./usePagedPanel";

interface ShowMoreProps {
    panel: PagedPanel;
    /** The list's length (after its search). */
    total: number;
    group?: string;
    className?: string;
}

/** A paged panel's "Show 20 more" under a list, nothing once it is all shown. */
export function ShowMore({ panel, total, group, className }: ShowMoreProps) {
    const more = panel.more(total, group);
    if (more === 0) return null;
    return (
        <TextButton onClick={() => panel.showMore(total, group)} {...(className ? { className } : {})}>
            Show {Math.min(panel.pageSize, more).toLocaleString('en-US')} more
        </TextButton>
    );
}
