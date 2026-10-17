/**
 * Visitor counts for both apps come from Umami Cloud: a cookieless script that counts only
 * browsers running JavaScript, so crawlers (which fetch every dictionary page) stay out of the
 * numbers, and SPA route changes are counted without any code in the app.
 *
 * The website id is not a secret (it is in every page) but it is passed in rather than written
 * here: only the production deploy sets it (VITE_UMAMI_WEBSITE_ID, from the UMAMI_WEBSITE_ID
 * repository variable), so local, CI and staging builds carry no tag and never count a visit.
 */
const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';

/** The `<script>` tag to put in a page's `<head>`, or "" when this build has no website id. */
export function analyticsScriptTag(websiteId: string | undefined): string {
    const id = websiteId?.trim();
    if (!id) return '';
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new Error(`Umami website id "${id}" is not a UUID`);
    return `<script defer src="${UMAMI_SCRIPT_URL}" data-website-id="${id}"></script>`;
}
