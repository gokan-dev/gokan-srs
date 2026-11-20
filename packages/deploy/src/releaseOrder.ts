/**
 * The order a release's members are built in (claude-start-release.yml). A release's members used
 * to be built one at a time in task-list order; independent members now build at once, and only a
 * member that must wait (same files or area, or it builds on another) waits for what it names.
 *
 * The pre-flight agent writes the order as JSON, one key per member, each naming the members it
 * waits for: `{ "172": [], "173": [172], "174": [] }`. It is untrusted (an agent wrote it), so it
 * is parsed here once and refused whole when anything is off; the workflow then falls back to
 * `serialOrder`, the old one-at-a-time order, which is always safe.
 */

/** One member and the members that must be merged before it starts, in task-list order. */
export interface MemberOrder {
    readonly member: number;
    readonly after: readonly number[];
}

export type ReleaseOrder = readonly MemberOrder[];

export type ParsedOrder =
    | { readonly ok: true; readonly order: ReleaseOrder }
    | { readonly ok: false; readonly problems: readonly string[] };

/** Each member waits for the one before it: the order a release had before members ran in parallel. */
export function serialOrder(members: readonly number[]): ReleaseOrder {
    return members.map((member, i) => ({ member, after: i === 0 ? [] : [members[i - 1]] }));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const MEMBER_KEY = /^#?([1-9]\d*)$/;

/**
 * Reads an order written for `members`. Every member must be listed, every id named must be a
 * member, no member waits for itself, and the waits have no cycle (a cycle would start nothing).
 */
export function parseReleaseOrder(raw: unknown, members: readonly number[]): ParsedOrder {
    if (!isRecord(raw)) return { ok: false, problems: ['The order is not a JSON object keyed by member.'] };
    const known = new Set(members);
    const problems: string[] = [];
    const after = new Map<number, number[]>();

    for (const [key, value] of Object.entries(raw)) {
        const id = MEMBER_KEY.exec(key);
        const member = id ? Number(id[1]) : NaN;
        if (!known.has(member)) {
            problems.push(`"${key}" is not a member of this release.`);
            continue;
        }
        if (after.has(member)) {
            problems.push(`#${member} is listed twice.`);
            continue;
        }
        if (!Array.isArray(value)) {
            problems.push(`#${member}: its waits are not a list of member numbers.`);
            after.set(member, []);
            continue;
        }
        const waits: number[] = [];
        for (const dep of value as unknown[]) {
            if (typeof dep !== 'number' || !Number.isInteger(dep)) problems.push(`#${member}: ${JSON.stringify(dep)} is not a member number.`);
            else if (!known.has(dep)) problems.push(`#${member} waits for #${dep}, which is not a member of this release.`);
            else if (dep === member) problems.push(`#${member} waits for itself.`);
            else if (!waits.includes(dep)) waits.push(dep);
        }
        after.set(member, waits);
    }
    for (const member of members) {
        if (!after.has(member)) problems.push(`#${member} is missing from the order.`);
    }
    if (problems.length) return { ok: false, problems };

    const cycle = findCycle(members, after);
    if (cycle) return { ok: false, problems: [`The waits form a cycle: ${cycle.map(m => `#${m}`).join(' -> ')}.`] };

    return { ok: true, order: members.map(member => ({ member, after: after.get(member) ?? [] })) };
}

/** A cycle in the waits, as the members walked around it (first repeated at the end), or none. */
function findCycle(members: readonly number[], after: ReadonlyMap<number, readonly number[]>): number[] | undefined {
    const state = new Map<number, 'open' | 'closed'>();
    const path: number[] = [];
    const visit = (member: number): number[] | undefined => {
        const seen = state.get(member);
        if (seen === 'closed') return undefined;
        if (seen === 'open') return [...path.slice(path.indexOf(member)), member];
        state.set(member, 'open');
        path.push(member);
        for (const dep of after.get(member) ?? []) {
            const cycle = visit(dep);
            if (cycle) return cycle;
        }
        path.pop();
        state.set(member, 'closed');
        return undefined;
    };
    for (const member of members) {
        const cycle = visit(member);
        if (cycle) return cycle;
    }
    return undefined;
}

/**
 * The members to start now, in task-list order: not merged, not already being built, and every
 * member they wait for merged. An acyclic order always has one to start while any is unmerged and
 * none is in flight, so a release never stalls on its own order.
 */
export function membersToStart(order: ReleaseOrder, merged: ReadonlySet<number>, inFlight: ReadonlySet<number>): number[] {
    return order
        .filter(({ member, after }) => !merged.has(member) && !inFlight.has(member) && after.every(dep => merged.has(dep)))
        .map(({ member }) => member);
}

/** The order as the maintainer reads it on the tracker: one line per member. */
export function describeOrder(order: ReleaseOrder): string {
    return order
        .map(({ member, after }) => `- #${member}: ${after.length ? `after ${after.map(m => `#${m}`).join(', ')}` : 'starts at once'}`)
        .join('\n');
}

/** The order as stored on the tracker and read back by `parseReleaseOrder`. */
export function orderToJson(order: ReleaseOrder): string {
    return JSON.stringify(Object.fromEntries(order.map(({ member, after }) => [String(member), after])));
}
