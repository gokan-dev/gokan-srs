import type { PropsWithChildren } from "react";
import { motion } from "framer-motion";

interface CardProps extends PropsWithChildren {
    interactive?: boolean;
    className?: string;
    size?: "sm" | "md" | "lg";
}

const SIZE_STYLES = {
    sm: "p-4 max-w-md",
    md: "p-5 md:p-6 max-w-xl",
    lg: "p-12 max-w-2xl",
};

export function Card({
    children,
    interactive = false,
    size = "md",
    className = "",
}: CardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className={`
                w-full mx-auto rounded-md bg-surface border border-divider
                ${className}
                ${SIZE_STYLES[size]}
                ${interactive ? "hover:bg-surface-hover cursor-pointer" : ""}
            `}
        >
            {children}
        </motion.div>
    );
}