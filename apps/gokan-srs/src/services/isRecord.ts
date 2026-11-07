// Apart from http.ts so a module vite.config.ts loads (utils/changelog.utils.ts) can narrow without
// importing the dataset loader: the config is run by Node, which cannot resolve the dataset
// projection http.ts imports (TypeScript, extensionless).

/** Whether an untrusted value is a plain object, the first narrowing step of every parser. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
