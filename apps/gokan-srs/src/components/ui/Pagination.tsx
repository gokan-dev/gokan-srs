import { Button } from "./Button";

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

/** Previous / "Page n of m" / Next. Renders nothing for a single page. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center gap-2 mt-4">
            <Button variant="ghost" disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
                Previous
            </Button>
            <span className="flex items-center text-sm text-secondary">
                Page {page} of {totalPages}
            </span>
            <Button variant="ghost" disabled={page === totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>
                Next
            </Button>
        </div>
    );
}
