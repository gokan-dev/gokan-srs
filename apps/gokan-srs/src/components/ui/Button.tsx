import type { ButtonHTMLAttributes } from "react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./buttonStyles";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    /** `sm` is the compact in-row action (a list row's "Learn"); `lg` the welcome page's ways in; `md` everything else. */
    size?: ButtonSize;
}

export function Button({
    children,
    variant = "primary",
    size = "md",
    className = "",
    ...props
}: ButtonProps) {
    return (
        <button {...props} className={buttonClassName(variant, size, className)}>
            {children}
        </button>
    );
}
