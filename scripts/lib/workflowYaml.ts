// What the conventions check reads of a GitHub Actions workflow, without a YAML parser: the
// workflows here use a handful of forms, and each is pinned by workflowYaml.test.ts.

const ON_INLINE = /^on:[ \t]*([^\s#].*?)\s*$/m;
const ON_BLOCK = /^on:[ \t]*(?:#.*)?\n((?:(?:[ \t]+.*|[ \t]*#.*)?\n)*)/m;

/** The events in a workflow's top-level `on:`: one event (`on: push`), a list (`on: [a, b]`) or a block of keys. */
export function workflowEvents(text: string): Set<string> {
    const inline = ON_INLINE.exec(text);
    if (inline) return new Set(inline[1].replace(/^\[|\]$/g, '').split(',').map(e => e.trim()).filter(Boolean));
    const block = ON_BLOCK.exec(`${text}\n`);
    return new Set(block ? [...block[1].matchAll(/^ {2}([\w-]+):/gm)].map(m => m[1]) : []);
}

/**
 * Why a listener never fires for a watched workflow that runs on none of the events it accepts, or
 * null when it runs on at least one. Accepting several (`push` or `pull_request`) needs only one.
 */
export function missedEvents(accepted: ReadonlySet<string>, runsOn: ReadonlySet<string>): string | null {
    if (accepted.size === 0 || [...accepted].some(event => runsOn.has(event))) return null;
    return `runs on none of ${[...accepted].join(', ')} (its \`on:\` has ${[...runsOn].join(', ') || 'nothing'})`;
}

/**
 * The listener file names an event list is declared for that no workflow file has: a list keyed by
 * a renamed listener checks its events against nothing, and the rule would pass everything.
 */
export function strandedListenerKeys(declared: Iterable<string>, workflowFiles: Iterable<string>): string[] {
    const files = new Set(workflowFiles);
    return [...declared].filter(key => !files.has(key));
}
