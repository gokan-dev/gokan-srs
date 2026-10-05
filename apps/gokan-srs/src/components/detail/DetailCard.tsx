import type { ReactNode } from "react";
import { Card } from "../ui/Card";
import { useResponsive } from "../../context/Responsive/useResponsive";

interface DetailCardProps {
    /** Card heading; omitted for a card that draws its own. */
    title?: ReactNode;
    /** Shown after the title, e.g. how many items the card lists. */
    count?: number;
    children: ReactNode;
}

/** One section card on a detail page (vocab, kanji, grammar). */
export function DetailCard({ title, count, children }: DetailCardProps) {
    const { isMobile } = useResponsive();
    return (
        <Card size={isMobile ? "sm" : "md"}>
            {title && (
                <h2 className="text-lg font-gothic font-semibold text-primary mb-4">
                    {title}
                    {count !== undefined && <span className="text-sm font-normal text-tertiary ml-2">({count})</span>}
                </h2>
            )}
            {children}
        </Card>
    );
}

/** A labelled value inside a detail card. */
export function DetailField({ label, children, large = false }: { label: string; children: ReactNode; large?: boolean }) {
    return (
        <div>
            <div className="text-xs text-tertiary uppercase tracking-wider font-gothic mb-1">{label}</div>
            <div className={`${large ? 'text-xl' : 'text-base'} text-primary font-gothic`}>{children}</div>
        </div>
    );
}
