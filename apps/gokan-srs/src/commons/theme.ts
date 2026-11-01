/**
 * Theme colours for the places a Tailwind class cannot reach: inline styles and SVG
 * attributes. Each value is a CSS variable defined in index.css, the only file that
 * writes colours as values, so these follow dark mode and can never drift from the
 * class-based palette.
 */
export const THEME = {
    colors: {
        accent: 'var(--accent)',
        correct: 'var(--feedback-correct)',
        incorrect: 'var(--feedback-incorrect)',
    },
    mastery: {
        track: 'var(--mastery-track)',
        loop1: 'var(--mastery-reading)',
        reading: { loop1: 'var(--mastery-reading)' },
        meaning: { loop1: 'var(--mastery-meaning)' },
        production: { loop1: 'var(--mastery-production)' },
    },
    /**
     * The accent in steps, for an ordinal series that is not a quiz direction (the
     * pacing forecast's Scheduled and Projected). The same variables as the
     * direction colours, under names that do not claim Reading or Meaning.
     */
    accentStep: {
        full: 'var(--mastery-reading)',
        mid: 'var(--mastery-meaning)',
    },
} as const;
