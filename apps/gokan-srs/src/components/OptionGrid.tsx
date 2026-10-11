import type { ReactNode } from "react";
import { SelectableOption } from "./ui/SelectableOption";

export const OptionGrid = <T extends string>(props: {
    /** A label above the options; left out when the section heading already names them. */
    title?: string;
    options: { value: T; label: string; description: ReactNode }[];
    value: T;
    onChange?: (v: T) => void;
    /** Single-column, tighter spacing - for the narrow in-quiz settings popover. */
    dense?: boolean;
    /** Columns from `sm` up (one column on a phone). */
    columns?: 2 | 3;
}) => {
    const dense = props.dense === true;

    return (
        <div className={dense ? "space-y-2" : "space-y-3"}>
            {props.title && (
                <h3 className="type-label">
                    {props.title}
                </h3>
            )}
            <div className={dense ? "grid grid-cols-1 gap-2" : `grid grid-cols-1 gap-3 ${props.columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {props.options.map((opt) => {
                    const selected = opt.value === props.value;
                    return (
                        <SelectableOption
                            key={opt.value}
                            selected={selected}
                            onSelect={() => props.onChange?.(opt.value)}
                            className={dense ? "p-3 pr-8" : "p-4 pr-8"}
                        >
                            <div className={`mb-1 font-sans font-medium text-primary ${dense ? 'text-sm' : 'text-base'}`}>
                                {opt.label}
                            </div>
                            <div className="type-support flex items-start">
                                {opt.description}
                            </div>
                        </SelectableOption>
                    );
                })}
            </div>
        </div>
    );
};
