export const THEME = {
    colors: {
        background: '#F5F0E8',
        feedbackBackground: '#F0EEE8',
        surface: '#FFFFFF',
        surfaceHover: '#E8E0D0',
        primary: '#1a1a2e',
        secondary: '#3D5A80',
        tertiary: '#7D7466',
        divider: '#E8E0D0',
        accent: '#3D5A80',
        accentHover: '#2A405D',
        error: '#8A3A2E',
        errorAccent: 'rgba(138, 58, 46, 0.45)', // 45% opacity
        inputPlaceholder: '#9AA0A6',
        meaningMuted: 'rgba(26, 26, 46, 0.6)', // primary with 60% opacity
        labelNeutral: '#8B8E93',
        muted: '#9ca3af',
        subtle: '#6b7280',
    },
    mastery: {
        track: '#E8E0D0',
        loop1: '#3D5A80',
        reading: {
            loop1: '#3D5A80',
        },
        meaning: {
            loop1: 'rgba(61, 90, 128, 0.6)', // Accent at 60% opacity
        },
        // Same accent again, a step fainter: the three directions are stages of one
        // word's mastery, and the design system reserves a second hue for errors.
        production: {
            loop1: 'rgba(61, 90, 128, 0.35)',
        }
    },
    fonts: {
        serif: '"Source Serif 4", Georgia, serif',
        mincho: '"Noto Serif JP", serif',
        gothic: '"Sawarabi Gothic", "Noto Sans JP", sans-serif', // For UI text
    },
    fontSizes: {
        xs: '0.75rem',      // 12px
        labelSmall: '0.6875rem', // 11px for uppercase labels
        sm: '0.875rem',     // 14px
        base: '1rem',       // 16px
        lg: '1.125rem',     // 18px
        xl: '1.25rem',      // 20px
        '2xl': '1.5rem',    // 24px
        kanji: '6.6rem',    // 105.6px (~10% increase from 96px)
    },
    spacing: {
        base: 4,
        labelMargin: 8,
        feedbackPadding: 16,
        buttonMarginTop: 28,
        errorBorderWidth: 2.5,
    },
    sizes: {
        buttonHeight: 44,
        borderRadius: 6,
    },
    transitions: {
        fast: '150ms',
        normal: '200ms',
        feedbackDelay: 1000,
    },
} as const;