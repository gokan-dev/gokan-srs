import type { ReactNode } from "react";

interface SettingSliderProps {
    label: string;
    description?: ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    /** Text shown next to the label for the current value, e.g. "From 50 on the meaning ring". */
    valueText: string;
    /** Read by assistive tech in place of the raw number, e.g. "From the first review". */
    ariaValueText?: string;
    disabled?: boolean;
    /** Tighter padding/typography, for the in-quiz settings popover. */
    dense?: boolean;
    className?: string;
}

/**
 * The label + description + range-input row used by a numeric setting, styled
 * to match SettingToggle (same card chrome, same label/description layout).
 * Extracted so any future numeric setting reuses one control rather than each
 * settings section styling its own <input type="range">.
 */
export function SettingSlider({
    label,
    description,
    value,
    min,
    max,
    step,
    onChange,
    valueText,
    ariaValueText,
    disabled = false,
    dense = false,
    className = "",
}: SettingSliderProps) {
    return (
        <div
            className={`bg-surface dark:bg-surface/5 rounded-lg border border-divider ${dense ? 'p-3' : 'p-4'} ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
        >
            <div className={`flex items-center justify-between gap-4 ${dense ? 'mb-3' : 'mb-4'}`}>
                <div className="flex flex-col gap-1">
                    <span className={`font-medium text-primary ${dense ? 'text-sm' : ''}`}>{label}</span>
                    {description && (
                        <span className={`text-secondary ${dense ? 'text-xs' : 'text-xs sm:text-sm'}`}>{description}</span>
                    )}
                </div>
                <span className={`flex-shrink-0 font-medium text-accent ${dense ? 'text-xs' : 'text-sm'}`}>
                    {valueText}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-valuetext={ariaValueText}
                className="w-full h-2 bg-divider rounded-lg appearance-none cursor-pointer accent-accent"
            />
        </div>
    );
}
