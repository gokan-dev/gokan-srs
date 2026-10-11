import type { ReactNode } from 'react';

/**
 * The dictionary is a separate statically generated app served from the
 * /dictionary prefix of this same origin, so it is a real page load (a plain
 * `<a>`), not a route this SPA knows about. Same tab deliberately: it is part of
 * the same site, and its own footer links back here.
 *
 * Note this 404s under `bun run dev`, where only the SRS app is served.
 */
export function DictionaryLink({ className, onClick, children = 'Dictionary' }: { className: string; onClick?: () => void; children?: ReactNode }) {
    return <a href="/dictionary/" className={className} onClick={onClick}>{children}</a>;
}
