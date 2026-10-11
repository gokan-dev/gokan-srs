import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Settings2, X } from "lucide-react";
import { Link } from "react-router-dom";

interface QuizSettingsMenuProps {
    /** Panel heading, e.g. "Vocabulary quiz settings". */
    title: string;
    /** The activity's own settings controls. */
    children: ReactNode;
}

/**
 * The cog affordance sitting at the top right of a study session, opening a
 * panel of settings scoped to THAT activity only (issue: per-activity quiz
 * settings). Settings that apply to every activity - appearance, SRS pacing,
 * AI context validation, cloud sync - deliberately stay on the global settings
 * page, which the panel links out to.
 *
 * Purely a shell: it owns the open/close behaviour and the panel chrome, never
 * the settings themselves, so each activity supplies its own body (see
 * pages/settings/sections/).
 */
export function QuizSettingsMenu({ title, children }: QuizSettingsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={title}
                title={title}
                className="cursor-pointer text-secondary hover:text-primary transition-colors p-1"
            >
                <Settings2 size={18} />
            </button>

            {/*
             * Rendered in a portal rather than inline: the quiz cards live inside
             * transformed/animated containers (framer-motion), which create a
             * containing block that an absolutely-positioned panel would be
             * clipped and mis-anchored by.
             */}
            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15, ease: "easeInOut" }}
                                className="fixed inset-0 bg-black/30"
                                onClick={() => setIsOpen(false)}
                            />

                            <motion.div
                                ref={panelRef}
                                role="dialog"
                                aria-modal="true"
                                aria-label={title}
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.15, ease: "easeInOut" }}
                                className="relative w-full max-w-md rounded-md bg-background border border-divider shadow-lg my-auto"
                            >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-divider">
                                    <h2 className="type-subsection">{title}</h2>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        aria-label="Close settings"
                                        className="cursor-pointer text-secondary hover:text-primary transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="px-5 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
                                    {children}
                                </div>

                                <div className="px-5 py-3 border-t border-divider">
                                    <Link
                                        to="/settings"
                                        onClick={() => setIsOpen(false)}
                                        className="font-sans text-sm text-accent hover:underline"
                                    >
                                        All settings
                                    </Link>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
