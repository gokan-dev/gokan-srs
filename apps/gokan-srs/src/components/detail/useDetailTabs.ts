import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePersistedControlsSnapshot, writePersistedControls } from "../../hooks/usePersistedControls";
import type { DetailTabSet } from "../../utils/detailTabs.utils";
import { useFullDetailPage } from "./useFullDetailPage";

/** A scroll the page makes itself is not the learner's: the section it lands on stays the open one. */
const OWN_SCROLL_MS = 300;
/**
 * How long a hash's section is held at the top while what is above it settles (a word's Kanji
 * section loads its kanji after the page, pushing Related down), unless the learner scrolls first.
 */
const HOLD_LANDING_MS = 1500;
/** What the learner scrolls with, which ends the hold. */
const LEARNER_SCROLLS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

interface DetailTabsOptions<T extends string> {
    set: DetailTabSet<T>;
    /** The ids' prefix (`word` gives `word-tab-sentence`, `word-panel-sentence`, `word-section-sentence`). */
    prefix: string;
    /** Which tabs this subject has (the first always). */
    has: Record<T, boolean>;
    /** The full page's sections, main column then side, in order: the ones a hash lands on. */
    sections: readonly T[];
    /** What comes before the sections has loaded, so a hash's section is where it stays. */
    settled: boolean;
}

export interface DetailTabs<T extends string> {
    /** One full page (from `lg`) rather than tabs. */
    full: boolean;
    available: readonly T[];
    open: T;
    /** A tab chosen: below `lg` it opens (its hash in the URL), on the full page its section comes into view, with focus. */
    choose: (tab: T) => void;
    /** The sticky tab row's frame (`DetailBody` `tabsRef`). */
    rowRef: RefObject<HTMLDivElement | null>;
    /** The open tab's panel. */
    panelRef: RefObject<HTMLDivElement | null>;
    tabId: (tab: T) => string;
    panelId: (tab: T) => string;
    sectionId: (tab: T) => string;
}

/**
 * The tab state of a tabbed detail page (a word's, a kanji's, a grammar point's), below `lg` and
 * from it alike (DESIGN_SYSTEM section 5, Tabs on phones, one full page on desktop):
 * - the open tab: the one chosen on this page, else the hash's, the remembered one or the first;
 * - below `lg`, a tab chosen while the row is stuck brings its panel's top just under the row;
 * - on the full page, a tab chosen scrolls to its section and focuses its heading, a hash lands
 *   on its section once `settled` (held there while content above it loads), and the section in
 *   view is kept as the open tab;
 * - crossing `lg` keeps the learner where they were.
 * A page keyed by its subject starts afresh on another one.
 */
export function useDetailTabs<T extends string>({ set, prefix, has, sections, settled }: DetailTabsOptions<T>): DetailTabs<T> {
    const navigate = useNavigate();
    const { pathname, hash } = useLocation();
    const full = useFullDetailPage();
    const available = set.tabs.filter(tab => has[tab]);
    const tabId = (tab: T) => `${prefix}-tab-${tab}`;
    const panelId = (tab: T) => `${prefix}-panel-${tab}`;
    const sectionId = (tab: T) => `${prefix}-section-${tab}`;

    // Derived on every render, so a tab whose content arrives late opens once it has.
    const remembered = usePersistedControlsSnapshot<{ tab: T }>(set.storageKey).tab;
    const [chosen, setChosen] = useState<T | null>(null);
    const open: T = chosen !== null && has[chosen] ? chosen : set.initial(hash, remembered, available);

    // Choosing a tab while the row is stuck brings its panel's top just under the row, so the
    // learner reads it from its start (the open tab, tapped again, too); while the row is in its
    // place, nothing moves. Another tab's panel is there only once it renders, hence the flag.
    const rowRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const scrollToPanel = useRef(false);
    const scrollPanelToTop = () => {
        const row = rowRef.current;
        const panel = panelRef.current;
        if (row && panel) window.scrollTo({ top: window.scrollY + panel.getBoundingClientRect().top - row.offsetHeight });
    };
    useLayoutEffect(() => {
        if (!scrollToPanel.current) return;
        scrollToPanel.current = false;
        scrollPanelToTop();
    }, [open]);

    // On the full page a tab is a section: choosing one scrolls to it, its heading just under the
    // viewport's top (`scroll-mt-6`), and leaves the URL as it is.
    const ownScrollAt = useRef(0);
    const scrollToSection = (tab: T) => {
        ownScrollAt.current = performance.now();
        document.getElementById(sectionId(tab))?.scrollIntoView({ block: 'start' });
    };

    const choose = (tab: T) => {
        if (full) {
            setChosen(tab);
            scrollToSection(tab);
            // A learner's choice moves keyboard focus with the scroll (a hash's landing does not):
            // the section's heading, so the next Tab continues in it and its name is announced.
            document.getElementById(sectionId(tab))?.querySelector<HTMLElement>('h2[tabindex]')?.focus({ preventScroll: true });
            return;
        }
        const row = rowRef.current;
        // Stuck: the row sits at the viewport's top while the page has scrolled past its place.
        const stuck = row !== null && row.getBoundingClientRect().top <= 0 && window.scrollY > 0;
        if (tab === open) {
            if (stuck) scrollPanelToTop();
        } else {
            scrollToPanel.current = stuck;
        }
        setChosen(tab);
        writePersistedControls(set.storageKey, { tab });
        // The hash names the tab (none for the first), replaced so tabs never fill the history.
        void navigate({ pathname, hash: set.hashOf(tab) }, { replace: true });
    };

    // A hash lands on its section on the full page once what comes before it has settled, once
    // per hash. Crossing `lg` keeps the learner where they were: the open tab's section comes into
    // view, and back, the section in view opens as the tab (the full page's scroll and resize keep
    // `chosen` on it, ahead of the frame's switch, which waits out the resize).
    const linked = set.tabOfHash(hash);
    const linkedShown = linked !== null && has[linked];
    const landedHash = useRef<string | null>(null);
    const releaseHold = useRef(() => {});
    const wasFull = useRef(full);
    useLayoutEffect(() => {
        if (wasFull.current === full) return;
        wasFull.current = full;
        landedHash.current = hash;
        if (full) {
            if (open !== set.first) scrollToSection(open);
        } else if (open !== set.first || window.scrollY > 0) {
            scrollPanelToTop();
        }
    });
    useLayoutEffect(() => {
        if (!full || !settled || !linkedShown || landedHash.current === hash) return;
        landedHash.current = hash;
        scrollToSection(linked);
        // Content arriving above it would push it down: land again as a section's height changes.
        releaseHold.current();
        releaseHold.current = holdAtTop(sections.map(sectionId), () => scrollToSection(linked));
    });
    useEffect(() => () => releaseHold.current(), []);
    const keepInView = useEffectEvent(() => {
        if (performance.now() - ownScrollAt.current < OWN_SCROLL_MS) return;
        const inView = sectionInView(sections, sectionId, set.first);
        if (inView) setChosen(inView);
    });
    useEffect(() => {
        if (!full) return;
        let frame = 0;
        const track = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => keepInView());
        };
        window.addEventListener('scroll', track, { passive: true });
        window.addEventListener('resize', track);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', track);
            window.removeEventListener('resize', track);
        };
    }, [full]);

    return { full, available, open, choose, rowRef, panelRef, tabId, panelId, sectionId };
}

/**
 * Keeps a landed section at the top for HOLD_LANDING_MS, landing it again whenever a section's
 * height changes, until the learner scrolls. The sections, not the page: the side column is the
 * shorter one, so a section in it growing pushes the next down without changing the page's height.
 * Returns its release.
 */
function holdAtTop(ids: readonly string[], land: () => void): () => void {
    const until = performance.now() + HOLD_LANDING_MS;
    const observer = new ResizeObserver(() => {
        if (performance.now() < until) land();
        else release();
    });
    const timer = window.setTimeout(() => release(), HOLD_LANDING_MS);
    function release() {
        window.clearTimeout(timer);
        observer.disconnect();
        for (const event of LEARNER_SCROLLS) window.removeEventListener(event, release);
    }
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
    }
    for (const event of LEARNER_SCROLLS) window.addEventListener(event, release, { passive: true });
    return release;
}

/**
 * The full page's section in view, which opens as the tab when the page crosses below `lg`: the
 * one under a line a third of the way down the viewport, the main column's ahead of the side's,
 * else the last one whose top has passed that line (the page's end), else the first.
 */
function sectionInView<T extends string>(sections: readonly T[], sectionId: (tab: T) => string, first: T): T | null {
    const line = window.innerHeight / 3;
    const placed = sections.flatMap(tab => {
        const el = document.getElementById(sectionId(tab));
        return el ? [{ tab, rect: el.getBoundingClientRect() }] : [];
    });
    if (placed.length === 0) return null;
    const under = placed.find(({ rect }) => rect.top <= line && rect.bottom > line);
    if (under) return under.tab;
    const passed = placed.filter(({ rect }) => rect.top <= line).sort((a, b) => b.rect.top - a.rect.top)[0];
    return passed?.tab ?? first;
}
