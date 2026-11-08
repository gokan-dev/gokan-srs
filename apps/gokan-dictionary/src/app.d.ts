import type { PageDocument } from '$lib/server/pages';

declare global {
    namespace App {
        interface Locals {
            /** Set by a page's load (lib/server/route.ts), read by the server hook to write its document. */
            document?: PageDocument;
        }
    }
}

export {};
