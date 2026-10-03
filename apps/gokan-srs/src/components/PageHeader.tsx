import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/Button";

interface PageHeaderProps {
    title: ReactNode;
    /** Renders a Back button in the left column when set. */
    onBack?: () => void;
    /** Optional content for the right column (e.g. a link to a related list). */
    right?: ReactNode;
    /** Page-specific spacing (padding, margins, max width). */
    className?: string;
}

/**
 * A page's title row: Back on the left, the title centered, an optional action on
 * the right.
 *
 * Nothing in it is absolutely positioned. The pages it replaced pinned Back with
 * `absolute left-0` and centered the title across the full row; an absolute element
 * takes no space, so on a phone a long title ran underneath the button.
 *
 * The grid keeps both properties that matter:
 * - The side columns are `minmax(max-content, 1fr)`: never narrower than their own
 *   content, so Back can never be squeezed into the title.
 * - The title column is `minmax(0, auto)`: it takes its full width when there is
 *   room and is the only column that shrinks when there is not, truncating instead
 *   of overlapping. With room to spare the two `1fr` sides are equal, so the title
 *   stays centered whether or not there is a right-hand action.
 */
export function PageHeader({ title, onBack, right, className = '' }: PageHeaderProps) {
    return (
        <header className={`w-full grid grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] items-center gap-2 ${className}`}>
            <div className="flex justify-start">
                {onBack && (
                    <Button variant="ghost" onClick={onBack}>
                        <ArrowLeft className="inline-block w-4 h-4 mr-1 align-text-bottom" aria-hidden="true" />Back
                    </Button>
                )}
            </div>
            <h1 className="min-w-0 truncate text-center text-base md:text-xl font-serif text-primary">
                {title}
            </h1>
            <div className="flex justify-end">{right}</div>
        </header>
    );
}
