import type { KanjiLearningMethod } from "../../models/user.model";

/**
 * The known-kanji editor's state. The known set is one durable union the user curates; a
 * learning order is a tool for filling it, never its definition, so switching order or moving
 * the count never throws away what is already marked.
 */
export type KanjiFormModel = {
    /** The primary order: what the count walks, and what sequences new vocab. */
    method: KanjiLearningMethod;
    /** The count input: how far into `method`'s list this visit's raises reach. 0 after a switch. */
    count: number;
    /**
     * Kanji filled in by counts and resets. `null` during setup until the user first marks a
     * kanji: the set is then the first `count` of whichever list is chosen, so picking an order
     * before a count reads as a plain choice.
     */
    seeded: Set<string> | null;
    /**
     * What raising the count added during this visit to the editor, and only kanji that were not
     * known before that raise: the one thing lowering may take back. Cleared by a switch and a
     * reset, and never stored, so after a reload lowering removes nothing.
     */
    raised: Set<string>;
    /** Kanji the user marked one by one. They win over every count, in every order, until a reset. */
    marked: Map<string, boolean>;
};

/**
 * `list` is the primary order's kanji once loaded, `null` while it loads: the previous list
 * stays on screen, but nothing that depends on positions can be applied to it.
 */
export type KanjiFormAction =
    | { type: 'SET_COUNT'; count: number; list: readonly string[] | null }
    | { type: 'TOGGLE'; kanji: string; list: readonly string[] | null }
    | { type: 'SET_METHOD'; method: KanjiLearningMethod; list: readonly string[] | null }
    | { type: 'RESET'; list: readonly string[] | null };

export function initialKanjiForm(method: KanjiLearningMethod, count: number, known?: ReadonlySet<string>): KanjiFormModel {
    return { method, count, seeded: known ? new Set(known) : null, raised: new Set(), marked: new Map() };
}

/**
 * How many of `list`'s first kanji are in `known`. Saved as `step`, which drives "By kanji"
 * sequencing, so new words follow what is known whatever the count input shows.
 */
export function knownPrefix(list: readonly string[], known: ReadonlySet<string>): number {
    const end = list.findIndex(kanji => !known.has(kanji));
    return end === -1 ? list.length : end;
}

/** The setup seed, the first `count` of the list, made concrete: all of it is this visit's own. */
function concrete(state: KanjiFormModel, list: readonly string[] | null): { seeded: Set<string>; raised: Set<string> } {
    if (state.seeded) return { seeded: state.seeded, raised: state.raised };
    const seed = list?.slice(0, state.count) ?? [];
    return { seeded: new Set(seed), raised: new Set(seed) };
}

/** The known set: what counts and resets filled in, with the user's own marks on top. */
export function knownKanjiOf(state: KanjiFormModel, list: readonly string[] | null): Set<string> {
    const { seeded } = concrete(state, list);
    if (state.marked.size === 0) return seeded;
    const known = new Set(seeded);
    for (const [kanji, isKnown] of state.marked) {
        if (isKnown) known.add(kanji);
        else known.delete(kanji);
    }
    return known;
}

/** The count the stepper shows, capped at the end of a shorter list. */
export function countOf(state: KanjiFormModel, list: readonly string[]): number {
    return list.length ? Math.min(state.count, list.length) : state.count;
}

export function kanjiFormReducer(state: KanjiFormModel, action: KanjiFormAction): KanjiFormModel {
    switch (action.type) {
        case 'SET_COUNT': {
            const { list } = action;
            if (!list) return state;
            const to = Math.min(action.count, list.length);
            if (to === countOf(state, list)) return state;
            // The setup seed simply follows the count.
            if (!state.seeded) return { ...state, count: to };
            const from = countOf(state, list);
            const known = knownKanjiOf(state, list);
            const seeded = new Set(state.seeded);
            const raised = new Set(state.raised);
            // Raising adds this order's kanji up to the new count and remembers the ones that were
            // not known yet; lowering takes back only those. Whatever was known before stays.
            if (to > from) {
                for (const kanji of list.slice(from, to)) {
                    if (known.has(kanji)) continue;
                    seeded.add(kanji);
                    raised.add(kanji);
                }
            } else {
                for (const kanji of list.slice(to, from)) {
                    if (!raised.delete(kanji)) continue;
                    seeded.delete(kanji);
                }
            }
            return { ...state, count: to, seeded, raised };
        }
        case 'TOGGLE': {
            const known = knownKanjiOf(state, action.list);
            const marked = new Map(state.marked);
            marked.set(action.kanji, !known.has(action.kanji));
            return { ...state, ...concrete(state, action.list), marked };
        }
        case 'SET_METHOD':
            if (action.method === state.method) return state;
            // Nothing chosen yet in setup: the default count carries over to the new order.
            if (!state.seeded) return { ...state, method: action.method };
            // The set is kept as it is; the new order's raises start from 0, and the previous
            // order's raises are now simply known, so lowering in this order cannot reach them.
            return { ...state, method: action.method, count: 0, raised: new Set() };
        case 'RESET': {
            const { list } = action;
            if (!list) return state;
            const count = countOf(state, list);
            return { ...state, count, seeded: new Set(list.slice(0, count)), raised: new Set(), marked: new Map() };
        }
    }
}
