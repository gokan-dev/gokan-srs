import type { ReactNode } from "react";
import { DetailCard, DetailField } from "./DetailCard";
import { SRSHistoryGraph, type SRSHistorySeries } from "../SRSHistoryGraph";

interface SrsStatsCardProps {
    totalReviews: number;
    /** Current interval in days. */
    interval: number;
    introductionAt: Date;
    /** When the next review is due (one line per direction for a word). */
    nextReview: ReactNode;
    series: SRSHistorySeries[];
}

/** The "Stats" card of a studied item's detail page: reviews, interval, dates and history graph. */
export function SrsStatsCard({ totalReviews, interval, introductionAt, nextReview, series }: SrsStatsCardProps) {
    return (
        <DetailCard title="Stats">
            <div className="grid grid-cols-2 gap-4">
                <DetailField label="Reviews" large>{totalReviews}</DetailField>
                <DetailField label="Interval" large>{interval.toFixed(1)}d</DetailField>
                <div className="col-span-2 pt-2 border-t border-divider grid grid-cols-2 gap-4">
                    <DetailField label="Introduced">{introductionAt.toLocaleDateString()}</DetailField>
                    <DetailField label="Next Review">{nextReview}</DetailField>
                </div>
                <div className="col-span-2">
                    <SRSHistoryGraph series={series} introDate={introductionAt} />
                </div>
            </div>
        </DetailCard>
    );
}
