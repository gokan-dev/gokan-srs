interface SearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    /** Read by a screen reader; not shown, the placeholder says it on screen. */
    label: string;
    placeholder?: string;
}

/** A search field inside a page: 44px high, 16px text on a phone (smaller makes iOS zoom). */
export function SearchField({ value, onChange, label, placeholder }: SearchFieldProps) {
    return (
        <label className="block">
            <span className="sr-only">{label}</span>
            <input
                type="search"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-11 bg-surface border border-divider rounded-md px-3 text-base font-sans text-primary placeholder:text-input-placeholder outline-none focus:border-accent transition-colors"
            />
        </label>
    );
}
