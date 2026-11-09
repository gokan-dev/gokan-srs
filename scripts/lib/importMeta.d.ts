// The scripts run on Bun, where `import.meta.env` is the process's environment. They reach
// dictionary modules that read their build settings through it (apps/gokan-dictionary/src/lib/
// site.ts, which Vite types with vite/client in the app): typed here as Bun gives it.
interface ImportMeta {
    readonly env: Readonly<Record<string, string | undefined>>;
}
