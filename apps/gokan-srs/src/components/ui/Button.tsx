import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger-outline" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    /** `sm` is the compact in-row action (a list row's "Learn"); `md` everything else. */
    size?: "md" | "sm";
}

/**
 * Each variant owns its colours completely: text, background and border are
 * set together so no two variants ever share a class a caller could partially
 * override. A `className` may add layout (width, flex, margin) but never a
 * colour, border or background class - that was the cause of the Danger zone
 * buttons rendering invisible (the override and the variant's own colour
 * classes had equal specificity, so which one painted was down to stylesheet
 * order, not JSX order).
 */
const VARIANT_STYLES: Record<ButtonVariant, string> = {
    primary: "bg-accent text-surface border-transparent hover:bg-accent-hover",
    secondary: "bg-surface text-primary border border-divider hover:bg-surface-hover",
    ghost: "bg-transparent text-secondary border-transparent hover:text-primary",
    "danger-outline": "bg-transparent text-error border border-error hover:bg-error/10",
    danger: "bg-error text-surface border-transparent hover:brightness-110",
};

export function Button({
    children,
    variant = "primary",
    size = "md",
    className = "",
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            className={`
                ${size === "sm" ? "h-8 px-3 text-sm" : "h-11 px-4 text-base"} rounded-md font-sans font-medium transition-colors duration-200
                flex items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
                ${VARIANT_STYLES[variant]}
                ${className}
            `.trim().replace(/\s+/g, ' ')}
        >
            {children}
        </button>
    );
}
