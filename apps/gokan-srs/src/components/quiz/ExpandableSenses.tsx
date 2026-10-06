import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { Sense } from "@gokan/dataset-schema";
import { useExpandableDefinitions } from "../../pages/quiz/quizFormatting";

interface ExpandableSensesProps {
    senses: Sense[];
    /** How many senses show before "+N more definitions". */
    maxDefs: number;
    /** Above the list, e.g. a "Meanings:" heading. */
    heading?: ReactNode;
    /** Below the list, e.g. the sentence's translation. */
    footer?: ReactNode;
}

/** A word's senses, revealed with the feedback of a vocab quiz card. */
export function ExpandableSenses({ senses, maxDefs, heading, footer }: ExpandableSensesProps) {
    const { displayedSenses, hasMoreDefs, isExpanded, toggleExpanded } = useExpandableDefinitions(senses, maxDefs);
    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-sm space-y-2 text-meaning-muted font-serif"
        >
            {heading}
            {displayedSenses.map((sense, index) => (
                <p key={index}>
                    {sense.appliesToReadings && sense.appliesToReadings.length > 0 && (
                        <span className="text-xs text-tertiary mr-2 font-gothic">[{sense.appliesToReadings.join(', ')}]</span>
                    )}
                    {sense.glosses.join(', ')}
                </p>
            ))}
            {hasMoreDefs && (
                <button
                    type="button"
                    onClick={toggleExpanded}
                    className="text-xs text-secondary hover:text-primary transition-colors py-1 cursor-pointer font-gothic"
                >
                    {isExpanded ? "Show less" : `+${senses.length - maxDefs} more definitions`}
                </button>
            )}
            {footer}
        </motion.div>
    );
}
