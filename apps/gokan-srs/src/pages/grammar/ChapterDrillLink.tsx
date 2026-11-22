import { DrillLink } from "../../components/DrillLink";

/**
 * An expanded chapter's way into its drill, between the chapter's header and its point rows.
 * The spacing is on the link, not the wrapper: whether the drill has cards is known only inside
 * DrillLink, so a chapter with no drill (or one still loading) leaves no blank band.
 */
export function ChapterDrillLink({ chapterId }: { chapterId: string }) {
    return (
        <div data-chapter-drill>
            <DrillLink set={{ kind: 'chapter', chapterId }} label="Drill the related points" className="mx-2 my-2" />
        </div>
    );
}
