// Every page is static HTML with no Svelte runtime (the build checks it): rendered on the
// server only, never hydrated. Each written as <path>/index.html.
export const csr = false;
export const prerender = true;
export const trailingSlash = 'always';
