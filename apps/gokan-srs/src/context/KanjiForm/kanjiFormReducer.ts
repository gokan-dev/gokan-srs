import type { KanjiLearningMethod } from "../../models/user.model";

/**
 * The known-kanji editor's state. The known set is one durable union the user curates; a
 * learning order is a tool for filling it, never its definition, so switching order or moving
 * the count never throws away what is already marked.
 */
export type KanjiFormModel = {
    /** The primary order: what the count walks, and what sequences new vocab. */
    method: KanjiLearningMethod;
    /**
     * How far into `method`'s list the count reaches. `null` right after a switch: it is then
     * how many of the new list's first kanji are already known, until the user moves it.
     */
    count: number | null;
    /**
     * Kanji filled in by counts and resets. `null` until the user first edits during setup: it
     * is then the first `count` of the list, so the default count shows before any choice.
     */
    seeded: Set<string> | null;
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
    return { method, count, seeded: known ? new Set(known) : null, marked: new Map() };
}

/** How many of `list`'s first kanji are in `known`. */
function knownPrefix(list: readonly string[], known: ReadonlySet<string>): number {
    const end = list.findIndex(kanji => !known.has(kanji));
    return end === -1 ? list.length : end;
}

function seededSet(state: KanjiFormModel, list: readonly string[] | null): Set<string> {
    if (state.seeded) return state.seeded;
    return new Set(list?.slice(0, state.count ?? 0) ?? []);
}

/** The known set: what counts and resets filled in, with the user's own marks on top. */
export function knownKanjiOf(state: KanjiFormModel, list: readonly string[] | null): Set<string> {
    if (state.marked.size === 0) return seededSet(state, list);
    const known = new Set(seededSet(state, list));
    for (const [kanji, isKnown] of state.marked) {
        if (isKnown) known.add(kanji);
        else known.delete(kanji);
    }
    return known;
}

/** The count the stepper shows, capped at the end of a shorter list. */
export function countOf(state: KanjiFormModel, list: readonly string[], known: ReadonlySet<string>): number {
    if (state.count === null) return knownPrefix(list, known);
    return list.length ? Math.min(state.count, list.length) : state.count;
}

export function kanjiFormReducer(state: KanjiFormModel, action: KanjiFormAction): KanjiFormModel {
    switch (action.type) {
        case 'SET_COUNT': {
            const { list } = action;
            if (!list) return state;
            const known = knownKanjiOf(state, list);
            const from = countOf(state, list, known);
            const to = Math.min(action.count, list.length);
            if (to === from && state.count !== null) return state;
            // Raising adds this order's kanji up to the new count; lowering takes back the ones
            // past it. Kanji from other orders outside that stretch, and the user's own marks, stay.
            const seeded = new Set(seededSet(state, list));
            if (to > from) for (const kanji of list.slice(from, to)) seeded.add(kanji);
            else for (const kanji of list.slice(to, from)) seeded.delete(kanji);
            return { ...state, count: to, seeded };
        }
        case 'TOGGLE': {
            const known = knownKanjiOf(state, action.list);
            const marked = new Map(state.marked);
            marked.set(action.kanji, !known.has(action.kanji));
            // A count following the known prefix is pinned first, so marking a kanji inside it
            // does not move the stepper under the user's hand.
            const count = state.count ?? (action.list ? knownPrefix(action.list, known) : null);
            return { ...state, count, seeded: seededSet(state, action.list), marked };
        }
        case 'SET_METHOD':
            if (action.method === state.method) return state;
            return { ...state, method: action.method, count: null, seeded: seededSet(state, action.list) };
        case 'RESET': {
            const { list } = action;
            if (!list) return state;
            const count = countOf(state, list, knownKanjiOf(state, list));
            return { ...state, count, seeded: new Set(list.slice(0, count)), marked: new Map() };
        }
    }
}
