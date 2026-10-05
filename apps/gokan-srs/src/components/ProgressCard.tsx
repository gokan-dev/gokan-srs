import type { ReactNode } from "react";
import { Card } from "./ui/Card";
import { CardContent } from "./ui/CardContent";
import { useNow } from "../hooks/useNow";
import { formatTimeUntil } from "../utils/time.utils";

interface ProgressCardProps {
    /** The item's name and chips, top left. */
    title: ReactNode;
    /** Its mastery ring(s), top right. */
    rings: ReactNode;
    /** One or two lines of meaning or explanation. */
    summary: ReactNode;
    progress: { stage: 'learning' | 'graduated'; totalReviews: number; nextReviewAt: Date | null };
    onClick?: () => void;
}

/** One studied item in a Stats list (vocab or grammar): name, rings, summary, review status. */
export function ProgressCard({ title, rings, summary, progress, onClick }: ProgressCardProps) {
    const now = useNow();
    return (
        <div
            onClick={onClick}
            className={`h-full transition-transform hover:scale-[1.02] active:scale-[0.98] ${onClick ? 'cursor-pointer' : ''}`}
        >
            <Card className="h-full flex flex-col justify-between">
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                        <div>{title}</div>
                        {rings}
                    </div>

                    <div className="text-sm text-secondary line-clamp-2">{summary}</div>

                    <div className="flex justify-between text-xs text-muted">
                        <span>{progress.stage === "graduated" ? "Mastered" : `Reviews: ${progress.totalReviews}`}</span>
                        <span>{formatTimeUntil(progress.nextReviewAt, now)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
