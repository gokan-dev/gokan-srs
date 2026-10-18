export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger-outline" | "danger";

export type ButtonSize = "sm" | "md" | "lg";

const SIZE_STYLES: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-sm font-medium",
    md: "h-11 px-4 text-base font-medium",
    lg: "h-13 px-6 gap-2.5 text-base font-semibold",
};

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

/**
 * A Button's classes, for a link that must look like one (the welcome page's "Browse the
 * dictionary first"): the one place a button's look is written.
 */
export function buttonClassName(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = ""): string {
    return `
        ${SIZE_STYLES[size]} rounded-md font-sans transition-colors duration-200
        flex items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANT_STYLES[variant]}
        ${className}
    `.trim().replace(/\s+/g, ' ');
}
