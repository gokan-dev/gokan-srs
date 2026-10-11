import type { ReactNode } from "react";
import { Chip } from "./ui/Chip";

/** A part-of-speech or word-type label beside a JLPT chip. */
export function TagChip({ children, size = 'md' }: { children: ReactNode; size?: 'sm' | 'md' }) {
    return <Chip size={size}>{children}</Chip>;
}
