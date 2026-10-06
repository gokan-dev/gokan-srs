import type { ReactNode } from "react";
import { motion } from "framer-motion";

/** The note shown under a quiz once it is answered: a bordered panel with a coloured left accent. */
export function FeedbackNote({ accentClass, children, className = '' }: { accentClass: string; children: ReactNode; className?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`border rounded bg-feedback-background border-divider border-l-4 p-4 ${accentClass} ${className}`}
        >
            {children}
        </motion.div>
    );
}
