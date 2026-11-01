import {
    useCallback,
    useEffect,
    useId,
    useReducer,
    useRef,
    useState,
    type FocusEvent,
    type KeyboardEvent,
    type MouseEvent,
    type PointerEvent,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
    cardPresentation,
    clickAction,
    focusOpens,
    pointerKindOf,
    lookupReducer,
    pendingDelay,
    type LookupTarget,
    type PointerKind,
    type TriggerKind,
} from "../../utils/lookup.utils";
import { BottomSheet } from "../ui/BottomSheet";
import { LookupCardBody } from "./LookupCardBody";
import { LookupPopover } from "./LookupPopover";

/**
 * Every card on screen, so opening one closes the others: a pin closes every card, a hover
 * card only the other hover cards (a pinned card stays until Esc, a click outside or another
 * pin).
 */
const openCards = new Map<string, { pinned: boolean; dismiss: () => void }>();

/** For a click with no pointer behind it (a script's, an assistive tool's): the device's main pointer. */
function canHover(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover)').matches;
}

/** What a trigger spreads on its element. */
export interface LookupTriggerProps {
    ref: (element: HTMLElement | null) => void;
    onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
    onBlur: (event: FocusEvent<HTMLElement>) => void;
    onClick: (event: MouseEvent<HTMLElement>) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
    'aria-haspopup'?: 'dialog';
    'aria-expanded'?: boolean;
}

/**
 * The lookup card of one trigger: its props, and the card to render beside it (never inside
 * it: the card is a portal, and React events bubble out of a portal to its React parent).
 *
 * A hovering pointer or the keyboard's focus opens the popover after `OPEN_DELAY_MS`, and it
 * stays while either is on the trigger or the card. An inline trigger (a sentence's word) pins
 * it on a click or Enter (Enter moving focus into it), or opens the bottom sheet on a tap; a link
 * trigger keeps its link, and on touch shows no card. No target, no card: the props do nothing.
 */
export function useLookup(target: LookupTarget | undefined, kind: TriggerKind): { triggerProps: LookupTriggerProps; card: ReactNode } {
    const [phase, dispatch] = useReducer(lookupReducer, 'closed');
    const [focusCard, setFocusCard] = useState(false);
    const triggerRef = useRef<HTMLElement | null>(null);
    const cardRef = useRef<HTMLDivElement | null>(null);
    const pointer = useRef<{ kind: PointerKind; at: number } | null>(null);
    /** Set while Esc hands focus back to the trigger: that focus must not open the card again. */
    const refocusing = useRef(false);
    const id = useId();
    const presentation = target ? cardPresentation(phase) : null;
    const pinned = phase === 'pinned' || phase === 'sheet';

    const dismiss = useCallback(() => {
        dispatch({ type: 'dismiss' });
        setFocusCard(false);
    }, []);
    /** Closes the card and gives focus back to its trigger: Esc, or Tab out of a pinned card. */
    const dismissToTrigger = useCallback(() => {
        dismiss();
        const trigger = triggerRef.current;
        if (!trigger || document.activeElement === trigger) return;
        refocusing.current = true;
        trigger.focus();
        refocusing.current = false;
    }, [dismiss]);

    useEffect(() => {
        const delay = pendingDelay(phase);
        if (delay === null) return;
        const timer = setTimeout(() => dispatch({ type: 'elapsed' }), delay);
        return () => clearTimeout(timer);
    }, [phase]);

    useEffect(() => {
        if (!presentation) return;
        for (const [other, card] of openCards) {
            if (other !== id && (pinned || !card.pinned)) card.dismiss();
        }
        openCards.set(id, { pinned, dismiss });
        return () => { openCards.delete(id); };
    }, [presentation, pinned, id, dismiss]);

    // The popover's dismissals; the sheet has its own (BottomSheet).
    useEffect(() => {
        if (presentation !== 'popover') return;
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const focused = document.activeElement;
            const focusWasOurs = focused !== null && (triggerRef.current?.contains(focused) === true || cardRef.current?.contains(focused) === true);
            if (focusWasOurs) dismissToTrigger();
            else dismiss();
        };
        const onPointerDown = (e: globalThis.PointerEvent) => {
            if (!(e.target instanceof Node)) return;
            if (triggerRef.current?.contains(e.target) || cardRef.current?.contains(e.target)) return;
            dismiss();
        };
        document.addEventListener('keydown', onKeyDown);
        if (phase === 'pinned') document.addEventListener('pointerdown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', onPointerDown);
        };
    }, [presentation, phase, dismiss, dismissToTrigger]);

    const pointerKind = (): PointerKind => pointer.current?.kind ?? (canHover() ? 'hover' : 'touch');
    const hovers = (e: PointerEvent<HTMLElement>) => target !== undefined && pointerKindOf(e.pointerType) === 'hover';
    const enter = () => dispatch({ type: 'enter' });
    const leave = () => dispatch({ type: 'leave' });

    // With no target every handler is a no-op, so a row without a card never re-renders on hover.
    const triggerProps: LookupTriggerProps = {
        ref: element => { triggerRef.current = element; },
        onPointerEnter: e => { if (hovers(e)) enter(); },
        onPointerLeave: e => { if (hovers(e)) leave(); },
        onPointerDown: e => {
            pointer.current = { kind: pointerKindOf(e.pointerType), at: e.timeStamp };
        },
        onFocus: e => {
            if (target && focusOpens(pointer.current, e.timeStamp, refocusing.current)) enter();
        },
        onBlur: e => {
            if (!target || (e.relatedTarget instanceof Node && cardRef.current?.contains(e.relatedTarget))) return;
            leave();
        },
        onClick: e => {
            if (!target) return;
            const action = clickAction(kind, pointerKind());
            pointer.current = null;
            if (action === 'follow') {
                dismiss();
                return;
            }
            // A sentence sits inside cards and rows with click handlers of their own.
            e.stopPropagation();
            dispatch({ type: action === 'pin' ? 'pin' : 'tap' });
        },
    };
    if (kind === 'inline' && target) {
        // Enter, and Space for a trigger announced as a button.
        triggerProps.onKeyDown = e => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            dispatch({ type: 'pin' });
            setFocusCard(true);
        };
        triggerProps['aria-haspopup'] = 'dialog';
        triggerProps['aria-expanded'] = presentation !== null;
    }

    let card: ReactNode = null;
    if (target && presentation === 'popover') {
        card = createPortal(
            <LookupPopover
                id={id}
                label={target.kind === 'word' ? 'Word' : 'Kanji'}
                anchorRef={triggerRef}
                cardRef={cardRef}
                focusOnOpen={focusCard}
                onEnter={enter}
                onLeave={leave}
                onExit={dismissToTrigger}
            >
                <LookupCardBody target={target} onNavigate={dismiss} />
            </LookupPopover>,
            document.body,
        );
    } else if (target && presentation === 'sheet') {
        card = (
            <BottomSheet label={target.kind === 'word' ? 'Word' : 'Kanji'} heading={null} onClose={dismiss}>
                <LookupCardBody target={target} onNavigate={dismiss} />
            </BottomSheet>
        );
    }
    return { triggerProps, card };
}
