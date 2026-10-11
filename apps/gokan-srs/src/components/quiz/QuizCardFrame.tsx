import type { FormEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { Card } from "../ui/Card";

const ENTER = {
    initial: { opacity: 0, scale: 0.98, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98 },
    transition: { duration: 0.18, ease: "easeInOut" },
} as const;

/*
 * The width lives on the wrapper, not only on the card: inside a centred flex
 * row the wrapper is a flex item that shrinks to its content, and the card's
 * `w-full` then resolved against that, so every card was as wide as what it
 * held (a vocab card wider than a grammar one).
 */
const FRAME_WIDTH = "w-full max-w-2xl mx-auto";

interface QuizCardFrameProps {
    children: ReactNode;
    /** When set, the card is a form and Enter submits it. */
    onSubmit?: (e: FormEvent) => void;
}

/**
 * The entrance animation, card, width and padding of every card in a study
 * session: the quiz cards, both intro cards, the chapter review and the kanji
 * unlock. One frame, so every card has the same size whatever it contains.
 */
export function QuizCardFrame({ children, onSubmit }: QuizCardFrameProps) {
    const { isMobile } = useResponsive();
    const card = <Card size="lg" className={isMobile ? '!p-4' : ''}>{children}</Card>;
    return onSubmit
        ? <motion.form onSubmit={onSubmit} className={FRAME_WIDTH} {...ENTER}>{card}</motion.form>
        : <motion.div className={FRAME_WIDTH} {...ENTER}>{card}</motion.div>;
}
