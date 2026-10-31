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
    lookupReducer,
    pendingDelay,
    type LookupTarget,
    type PointerKind,
    type TriggerKind,
} from "../../utils/lookup.utils";
import { BottomSheet } from "../ui/BottomSheet";
import { LookupCardBody } from "./LookupCardBody";
import { LookupPopover } from "./LookupPopover";

/** A tap focuses some links on its way to opening them; that focus is not the keyboard's. */
const TOUCH_FOCUS_WINDOW_MS = 1000;

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
    'aria-describedby'?: string;
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
    const id = useId();
    const presentation = target ? cardPresentation(phase) : null;
    const pinned = phase === 'pinned' || phase === 'sheet';

    const dismiss = useCallback((returnFocus = false) => {
        dispatch({ type: 'dismiss' });
        setFocusCard(false);
        if (returnFocus) triggerRef.current?.focus();
    }, []);

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
        openCards.set(id, { pinned, dismiss: () => dismiss() });
        return () => { openCards.delete(id); };
    }, [presentation, pinned, id, dismiss]);

    // The popover's dismissals; the sheet has its own (BottomSheet).
    useEffect(() => {
        if (presentation !== 'popover') return;
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const focused = document.activeElement;
            dismiss(focused !== null && (triggerRef.current?.contains(focused) === true || cardRef.current?.contains(focused) === true));
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
    }, [presentation, phase, dismiss]);

    const pointerKind = (): PointerKind => pointer.current?.kind ?? (canHover() ? 'hover' : 'touch');
    // The event's own pointer, not the device's: a laptop with a touchscreen has both.
    const hovers = (e: PointerEvent<HTMLElement>) => e.pointerType !== 'touch';
    const enter = () => dispatch({ type: 'enter' });
    const leave = () => dispatch({ type: 'leave' });

    const triggerProps: LookupTriggerProps = {
        ref: element => { triggerRef.current = element; },
        onPointerEnter: e => { if (hovers(e)) enter(); },
        onPointerLeave: e => { if (hovers(e)) leave(); },
        onPointerDown: e => {
            pointer.current = { kind: hovers(e) ? 'hover' : 'touch', at: e.timeStamp };
        },
        onFocus: e => {
            const touched = pointer.current?.kind === 'touch' && e.timeStamp - pointer.current.at < TOUCH_FOCUS_WINDOW_MS;
            if (!touched) enter();
        },
        onBlur: e => {
            if (e.relatedTarget instanceof Node && cardRef.current?.contains(e.relatedTarget)) return;
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
        triggerProps.onKeyDown = e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            dispatch({ type: 'pin' });
            setFocusCard(true);
        };
        triggerProps['aria-haspopup'] = 'dialog';
        triggerProps['aria-expanded'] = presentation !== null;
    } else if (presentation === 'popover') {
        triggerProps['aria-describedby'] = id;
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
                onEscape={() => dismiss(true)}
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
