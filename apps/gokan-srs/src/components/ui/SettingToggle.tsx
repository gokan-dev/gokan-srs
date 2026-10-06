import type { ReactNode } from "react";

interface SettingToggleProps {
    label: string;
    description?: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    /** Tighter padding/typography, for the in-quiz settings popover. */
    dense?: boolean;
    className?: string;
}

/**
 * The label + description + switch row used by every boolean setting.
 * Extracted from Settings.tsx so the same control renders identically whether
 * it is shown on the global settings page or inside an activity's own
 * settings popover (QuizSettingsMenu).
 */
export function SettingToggle({
    label,
    description,
    checked,
    onChange,
    disabled = false,
    dense = false,
    className = "",
}: SettingToggleProps) {
    return (
        <div
            className={`flex items-center justify-between bg-surface dark:bg-surface/5 rounded-lg border border-divider ${dense ? 'p-3' : 'p-4'} ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
        >
            <div className="flex flex-col gap-1 pr-4">
                <span className={`font-medium text-primary ${dense ? 'text-sm' : ''}`}>{label}</span>
                {description && (
                    <span className={`text-secondary ${dense ? 'text-xs' : 'text-xs sm:text-sm'}`}>{description}</span>
                )}
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <div className="w-11 h-6 bg-divider peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-surface after:border-divider after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
        </div>
    );
}
