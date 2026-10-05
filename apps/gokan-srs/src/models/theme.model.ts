export const THEMES = ['dark', 'light', 'system'] as const;

export type Theme = typeof THEMES[number];

export function isTheme(value: unknown): value is Theme {
    return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}
