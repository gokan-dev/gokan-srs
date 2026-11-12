import { defineEnvVars } from '@sveltejs/kit/env';

/** The server's environment (SvelteKit 3: declared here, read from `$app/env/private`). */
export const variables = defineEnvVars({
    DATASET_ORIGIN: {
        description: 'The origin serving /dataset/ and the search index to the server that renders pages on request, e.g. https://gokan-srs.com. Unset while building: the build reads the checkout.',
        // Optional here: lib/server/dictionary.ts refuses to render on request without it, in its own words.
        schema: value => value,
    },
});