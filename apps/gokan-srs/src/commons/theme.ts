/**
 * Theme colours for the places a Tailwind class cannot reach: inline styles and SVG
 * attributes. Each value is a CSS variable defined in index.css, the only file that
 * writes colours as values, so these follow dark mode and can never drift from the
 * class-based palette.
 */
export const THEME = {
    colors: {
        secondary: 'var(--secondary)',
        error: 'var(--error)',
    },
    mastery: {
        track: 'var(--mastery-track)',
        loop1: 'var(--mastery-reading)',
        reading: { loop1: 'var(--mastery-reading)' },
        meaning: { loop1: 'var(--mastery-meaning)' },
        production: { loop1: 'var(--mastery-production)' },
    },
} as const;
