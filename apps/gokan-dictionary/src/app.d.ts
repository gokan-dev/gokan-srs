import type { Alternate, PageDocument } from '$lib/server/pages';

declare global {
    namespace App {
        interface Locals {
            /** Set by a page's load (lib/server/route.ts), read by the server hook to write its document. */
            document?: PageDocument;
        }
        interface PageData {
            /** The page in every served locale that has it (lib/server/route.ts): the language switcher's links. */
            alternates?: Alternate[];
        }
    }
}

export {};
