import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
    /** The sheet's name, for a screen reader; shown as its heading unless `heading` replaces it. */
    label: string;
    /** What the heading row shows instead of `label`; null for none (a lookup card names its word itself). */
    heading?: ReactNode | null;
    onClose: () => void;
    children: ReactNode;
    /** Layout on the outer layer only (`md:hidden` for the phone navigation's More). */
    className?: string;
}

/**
 * A panel over the bottom of the screen on a dimmed backdrop: the phone navigation's More and
 * a lookup card on touch. Esc, the 44px Close and a tap on the backdrop close it. Rendered into
 * `document.body`, so a card or a row that clips its content cannot cut it off.
 */
export function BottomSheet({ label, heading, onClose, children, className = '' }: BottomSheetProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const close = (
        <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            data-sheet-close
            className="shrink-0 flex items-center justify-center w-11 h-11 rounded-md text-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
        >
            <X size={18} />
        </button>
    );

    return createPortal(
        <div
            className={`fixed inset-0 z-50 ${className}`}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            data-bottom-sheet
            // React events leave a portal for its React parents: a sheet opened from a quiz card
            // must not reach the card's click and Enter handlers. Esc is handled here for the same reason.
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Escape') onClose();
            }}
        >
            <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 w-full h-full bg-primary/20 cursor-default" />
            {/* Centred and capped on a wide screen (a tablet), where a full-width sheet spreads its content apart. */}
            <div className="absolute inset-x-0 bottom-0 sm:max-w-lg sm:mx-auto max-h-[85vh] overflow-y-auto bg-surface border-t border-divider sm:border-x rounded-t-md shadow-lg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {heading === null ? (
                    // No heading row: Close sits in the corner, the content's first line beside it.
                    <>
                        <div className="absolute top-2 right-2">{close}</div>
                        <div className="pr-10">{children}</div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="min-w-0">{heading ?? <h2 className="type-subsection">{label}</h2>}</div>
                            <div className="-mr-2">{close}</div>
                        </div>
                        {children}
                    </>
                )}
            </div>
        </div>,
        document.body,
    );
}
