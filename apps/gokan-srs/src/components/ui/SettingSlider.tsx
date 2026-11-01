import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";

interface SettingSliderProps {
    label: string;
    description?: ReactNode;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    /**
     * Called once the value is let go, on the range's native `change` event: once
     * on a pointer's release (wherever the pointer is), on each key step and on
     * each assistive-tech adjustment. For a setting that records each change
     * (review pacing), so a drag commits once rather than on every step. React's
     * `onChange` is the `input` event, which fires on every step of a drag.
     */
    onCommit?: (value: number) => void;
    /**
     * Waits this long after the last `change` before committing, so a burst of
     * key steps (or a held key's repeats) is one commit. A pending commit is
     * flushed at once on blur and on unmount, so leaving never loses it.
     */
    commitDelayMs?: number;
    /** Text shown next to the label for the current value, e.g. "From 50 on the meaning ring". */
    valueText: string;
    /** Read by assistive tech in place of the raw number, e.g. "From the first review". */
    ariaValueText?: string;
    disabled?: boolean;
    /** Tighter padding/typography, for the in-quiz settings popover. */
    dense?: boolean;
    className?: string;
    /** Shown under the range, inside the card: what the value buys (the pacing forecast). */
    children?: ReactNode;
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
    onCommit,
    commitDelayMs = 0,
    valueText,
    ariaValueText,
    disabled = false,
    dense = false,
    className = "",
    children,
}: SettingSliderProps) {
    const input = useRef<HTMLInputElement>(null);
    const commit = useEffectEvent((value: number) => onCommit?.(value));
    const delay = useEffectEvent(() => commitDelayMs);
    useEffect(() => {
        const range = input.current;
        if (!range) return;
        let pending: { timer: ReturnType<typeof setTimeout>; value: number } | null = null;
        const flush = () => {
            if (!pending) return;
            clearTimeout(pending.timer);
            const { value } = pending;
            pending = null;
            commit(value);
        };
        const onNativeChange = () => {
            const value = Number(range.value);
            const wait = delay();
            if (wait <= 0) {
                commit(value);
                return;
            }
            if (pending) clearTimeout(pending.timer);
            pending = { timer: setTimeout(flush, wait), value };
        };
        range.addEventListener('change', onNativeChange);
        range.addEventListener('blur', flush);
        return () => {
            range.removeEventListener('change', onNativeChange);
            range.removeEventListener('blur', flush);
            flush();
        };
    }, []);
    return (
        <div
            className={`bg-surface rounded-md border border-divider ${dense ? 'p-3' : 'p-4'} ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
        >
            <div className={`flex items-center justify-between gap-4 ${dense ? 'mb-3' : 'mb-4'}`}>
                <div className="flex flex-col gap-1">
                    <span className={`font-sans font-medium text-primary ${dense ? 'text-sm' : 'text-base'}`}>
                        {label}: <span className="tabular-nums">{valueText}</span>
                    </span>
                    {description && <span className="type-support">{description}</span>}
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                ref={input}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-valuetext={ariaValueText}
                className="w-full h-2 bg-divider rounded-full appearance-none cursor-pointer accent-accent"
            />
            {children}
        </div>
    );
}
