/**
 * Parses a response's JSON body. The one place a response body is given a type:
 * the caller names the shape it expects, and the compiled dataset's schema (the
 * dataset repository's docs/SCHEMA.md) or the remote API is what guarantees it.
 */
export async function readJson<T>(response: Response): Promise<T> {
    const body: unknown = await response.json();
    return body as T;
}

/**
 * Fetches a URL and parses its JSON body, failing on a non-2xx status. Every
 * service loads JSON through this rather than keeping its own copy.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    return readJson<T>(response);
}
