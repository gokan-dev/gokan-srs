/** What a lookup card is about: a dictionary word, or one kanji. */
export type LookupTarget = { kind: 'word'; vocabId: string } | { kind: 'kanji'; glyph: string };

/**
 * How a trigger behaves on a click or Enter. `inline`: Japanese text that is not a link of its
 * own (a sentence's word, a headword's kanji): the click pins the card. `link`: a tile or a row
 * that already links somewhere: the click follows the link, as it always has.
 */
export type TriggerKind = 'inline' | 'link';

/** The pointer behind an interaction: one that can hover (a mouse, a pen), or a finger. */
export type PointerKind = 'hover' | 'touch';

/** The pointer of an event (`PointerEvent.pointerType`), not of the device: a laptop with a touchscreen has both. */
export function pointerKindOf(pointerType: string): PointerKind {
    return pointerType === 'touch' ? 'touch' : 'hover';
}

/** A tap focuses some links on its way to opening them; that focus is not the keyboard's. */
export const TOUCH_FOCUS_WINDOW_MS = 1000;

/**
 * Whether a focus on the trigger opens its card: the keyboard's does; one that follows a tap
 * (the last pointer down, within `TOUCH_FOCUS_WINDOW_MS`) does not, nor does the focus Esc hands
 * back to the trigger when it closes the card (`returning`), or the card would open again.
 */
export function focusOpens(lastPointer: { kind: PointerKind; at: number } | null, at: number, returning: boolean): boolean {
    if (returning) return false;
    return !(lastPointer?.kind === 'touch' && at - lastPointer.at < TOUCH_FOCUS_WINDOW_MS);
}

/** What a click (a tap) on a trigger does. */
export type ClickAction = 'pin' | 'sheet' | 'follow';

/**
 * A link trigger keeps its link on every pointer: on touch its page is the card's content, so a
 * tap opening a sheet would only stand between the learner and it. An inline trigger pins the
 * popover with a mouse, and opens the bottom sheet on touch, which has no hover to show it.
 */
export function clickAction(kind: TriggerKind, pointer: PointerKind): ClickAction {
    if (kind === 'link') return 'follow';
    return pointer === 'touch' ? 'sheet' : 'pin';
}

/** Hover or focus dwell before the card opens (and its data loads), so sweeping a sentence opens nothing. */
export const OPEN_DELAY_MS = 220;
/** Grace on leaving the trigger or the card, so moving from one to the other does not close it. */
export const CLOSE_DELAY_MS = 120;

/**
 * Where one trigger's card is. `opening` and `closing` wait out their delay (`pendingDelay`);
 * `open` follows the pointer or focus; `pinned` stays until dismissed; `sheet` is the touch card.
 */
export type LookupPhase = 'closed' | 'opening' | 'open' | 'closing' | 'pinned' | 'sheet';

export type LookupEvent =
    /** A hovering pointer or the keyboard focus arrived on the trigger or the card. */
    | { type: 'enter' }
    /** It left them. */
    | { type: 'leave' }
    /** The pending delay ran out. */
    | { type: 'elapsed' }
    /** A click (or Enter) pinned the card. */
    | { type: 'pin' }
    /** A tap opened the touch sheet. */
    | { type: 'tap' }
    /** Esc, a click outside, Close, the backdrop, or another card opening. */
    | { type: 'dismiss' };

export function lookupReducer(phase: LookupPhase, event: LookupEvent): LookupPhase {
    switch (event.type) {
        case 'dismiss': return 'closed';
        case 'pin': return phase === 'sheet' ? 'sheet' : 'pinned';
        case 'tap': return 'sheet';
        case 'enter':
            if (phase === 'closed') return 'opening';
            return phase === 'closing' ? 'open' : phase;
        case 'leave':
            if (phase === 'opening') return 'closed';
            return phase === 'open' ? 'closing' : phase;
        case 'elapsed':
            if (phase === 'opening') return 'open';
            return phase === 'closing' ? 'closed' : phase;
    }
}

/** How long a phase waits before `elapsed`, or null when it waits for nothing. */
export function pendingDelay(phase: LookupPhase): number | null {
    if (phase === 'opening') return OPEN_DELAY_MS;
    if (phase === 'closing') return CLOSE_DELAY_MS;
    return null;
}

/** Whether the card is on screen, and as what. */
export function cardPresentation(phase: LookupPhase): 'popover' | 'sheet' | null {
    if (phase === 'sheet') return 'sheet';
    return phase === 'open' || phase === 'closing' || phase === 'pinned' ? 'popover' : null;
}

/** The kanji of a headword, each with its place, for a card per glyph; the kana between are text. */
export function headwordGlyphs(headword: string, kanji: readonly string[]): { text: string; kanji: boolean }[] {
    const isKanji = new Set(kanji);
    const parts: { text: string; kanji: boolean }[] = [];
    for (const char of headword) {
        const last = parts.at(-1);
        if (isKanji.has(char)) parts.push({ text: char, kanji: true });
        else if (last && !last.kanji) last.text += char;
        else parts.push({ text: char, kanji: false });
    }
    return parts;
}

/**
 * Where a popover goes, in viewport pixels: the card's left edge, and the edge it is pinned by.
 * Above the trigger it is pinned by its bottom (`bottom`, from the viewport's bottom edge), below
 * by its top, so a card that grows as its data arrives grows away from its trigger, never over it.
 */
export type PopoverPlace = { left: number; top: number } | { left: number; bottom: number };

/**
 * Where a popover goes: above its trigger and centred on it, clamped into the viewport (a word
 * at a line's end would put half the card off-screen), and below it when there is no room above,
 * the common case for a sentence's first line.
 *
 * Pinned by the edge facing the trigger (`PopoverPlace`): a card opens on its loading line and
 * grows when the word arrives. Pinned by its top above the trigger, it grew down over the trigger
 * for a frame before it was placed again, and the trigger lost its hover there and then (the word
 * flickered, and the pointer left it and came back).
 */
export function placePopover(
    anchor: { left: number; top: number; bottom: number; width: number },
    card: { width: number; height: number },
    viewport: { width: number; height: number },
    margin = 8,
): PopoverPlace {
    const centre = anchor.left + anchor.width / 2;
    const left = Math.min(Math.max(margin, centre - card.width / 2), Math.max(margin, viewport.width - card.width - margin));
    const fitsAbove = anchor.top - card.height - margin >= margin;
    return fitsAbove ? { left, bottom: viewport.height - anchor.top + margin } : { left, top: anchor.bottom + margin };
}
