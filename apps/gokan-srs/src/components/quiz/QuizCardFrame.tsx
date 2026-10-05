import type { FormEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import { useResponsive } from "../../context/Responsive/useResponsive";
import { Card } from "../ui/Card";

const ENTER = {
    initial: { opacity: 0, scale: 0.98, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98 },
    transition: { duration: 0.3, ease: "easeOut" },
} as const;

interface QuizCardFrameProps {
    children: ReactNode;
    /** When set, the card is a form and Enter submits it. */
    onSubmit?: (e: FormEvent) => void;
}

/** The entrance animation and card every quiz card (vocab and grammar) is drawn in. */
export function QuizCardFrame({ children, onSubmit }: QuizCardFrameProps) {
    const { isMobile } = useResponsive();
    const card = <Card size="lg" className={isMobile ? '!p-4' : ''}>{children}</Card>;
    return onSubmit
        ? <motion.form onSubmit={onSubmit} {...ENTER}>{card}</motion.form>
        : <motion.div {...ENTER}>{card}</motion.div>;
}
