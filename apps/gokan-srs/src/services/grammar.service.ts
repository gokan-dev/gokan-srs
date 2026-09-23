import type { GrammarAliasIndex, GrammarBrowseIndex, GrammarChapter, GrammarConjugationIndex, GrammarContrastForFocus, GrammarContrastIndex, GrammarInterchangeableForPoint, GrammarJlptIndex, GrammarKindIndex, GrammarPoint, GrammarTeachingOrder, GrammarVariantGroupIndex } from '../models/grammar.model';

/**
 * Loads grammar data compiled by the gokan-dataset submodule's
 * scripts/build-grammar.ts into compiled/grammar/, synced into
 * public/data/compiled/grammar/ by sync-dataset.ts like every other dataset
 * (vocab, kanji, sentences). Mirrors VocabularyService's loading pattern
 * (fetch + in-memory cache) - see CLAUDE.md's Grammar section.
 */
export class GrammarService {
    private static jlptIndex: GrammarJlptIndex | null = null;
    private static teachingOrder: GrammarTeachingOrder | null = null;
    private static chapterByPointId: Map<string, GrammarChapter> | null = null;
    private static aliases: GrammarAliasIndex | null = null;
    private static kinds: GrammarKindIndex | null = null;
    private static conjugations: GrammarConjugationIndex | null = null;
    private static variantGroups: GrammarVariantGroupIndex | null = null;
    private static browseIndex: GrammarBrowseIndex | null = null;
    private static contrasts: GrammarContrastIndex | null = null;
    private static contrastsByFocus: Map<string, GrammarContrastForFocus[]> | null = null;
    private static interchangeableByPoint: Map<string, GrammarInterchangeableForPoint> | null = null;
    private static pointCache = new Map<string, GrammarPoint>();

    private static async fetchJson<T>(path: string): Promise<T> {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
        }
        return response.json();
    }

    static async loadJlptIndex(): Promise<GrammarJlptIndex | null> {
        if (this.jlptIndex) return this.jlptIndex;

        this.jlptIndex = await this.fetchJson<GrammarJlptIndex>(`/data/compiled/grammar/index/jlpt.json?v=${Date.now()}`);
        return this.jlptIndex;
    }

    /**
     * The dataset's authored introduction order (`index/teaching-order.json`).
     *
     * Returns null if the file can't be loaded, and callers fall back to the
     * JLPT index. That fallback is deliberately all-or-nothing: a PARTIAL order
     * silently resuming alphabetical mid-sequence would be invisible, whereas
     * "no order file at all, using the old behaviour" is at least a coherent
     * state. The dataset build already guarantees the file covers every point,
     * so a half-populated file shouldn't be reachable.
     */
    static async loadTeachingOrder(): Promise<GrammarTeachingOrder | null> {
        if (this.teachingOrder) return this.teachingOrder;

        try {
            const loaded = await this.fetchJson<GrammarTeachingOrder>(`/data/compiled/grammar/index/teaching-order.json?v=${Date.now()}`);
            if (!loaded?.order?.length || !loaded?.chapters?.length) return null;
            this.teachingOrder = loaded;
            return this.teachingOrder;
        } catch (e) {
            console.error('[GrammarService] Failed to load teaching order; falling back to JLPT order', e);
            return null;
        }
    }

    /**
     * Point id -> kind. On failure returns {}, which means "treat everything as
     * testable" - the pre-kind behaviour. That is the right failure direction:
     * a missing index should not empty the learning queue.
     */
    static async loadKinds(): Promise<GrammarKindIndex> {
        if (this.kinds) return this.kinds;

        try {
            this.kinds = await this.fetchJson<GrammarKindIndex>(`/data/compiled/grammar/index/kinds.json?v=${Date.now()}`);
            return this.kinds;
        } catch (e) {
            console.error('[GrammarService] Failed to load grammar kinds; not filtering the pipeline by kind', e);
            return {};
        }
    }

    /**
     * Drill items for the inflection points. On failure returns {}, which means
     * no inflection point is teachable - those points then stay out of the
     * pipeline, which is the same state as before the quiz existed. Failing
     * closed is right here: serving an inflection point with no drill item would
     * present an unanswerable card.
     */
    static async loadConjugations(): Promise<GrammarConjugationIndex> {
        if (this.conjugations) return this.conjugations;

        try {
            this.conjugations = await this.fetchJson<GrammarConjugationIndex>(`/data/compiled/grammar/conjugations.json?v=${Date.now()}`);
            return this.conjugations;
        } catch (e) {
            console.error('[GrammarService] Failed to load conjugation drills; inflection points stay out of the pipeline', e);
            return {};
        }
    }

    /**
     * Canonical id -> realizations. On failure returns {}, which means every point
     * is drilled on its own examples only - the pre-variant behaviour. Safe to
     * fail this way: the learner just never sees the alternation.
     */
    static async loadVariantGroups(): Promise<GrammarVariantGroupIndex> {
        if (this.variantGroups) return this.variantGroups;

        try {
            this.variantGroups = await this.fetchJson<GrammarVariantGroupIndex>(`/data/compiled/grammar/index/variant-groups.json?v=${Date.now()}`);
            return this.variantGroups;
        } catch (e) {
            console.error('[GrammarService] Failed to load variant groups; drilling canonical forms only', e);
            return {};
        }
    }

    /**
     * The whole dataset as summary rows, for the browse page. ~70 KB gzipped, so
     * it is fetched only when that route is opened, never as part of a session.
     */
    static async loadBrowseIndex(): Promise<GrammarBrowseIndex | null> {
        if (this.browseIndex) return this.browseIndex;

        try {
            this.browseIndex = await this.fetchJson<GrammarBrowseIndex>(`/data/compiled/grammar/index/browse.json?v=${Date.now()}`);
            return this.browseIndex;
        } catch (e) {
            console.error('[GrammarService] Failed to load the grammar browse index', e);
            return null;
        }
    }

    /**
     * Family id -> its authored contrast clusters. On failure returns {} without
     * caching, so a transient fetch error retries next time rather than
     * permanently disabling contrast lessons for the session (matching loadKinds).
     * A missing file is not an error: contrasts are optional, and a family with
     * none simply shows the abstract differentiator it always did.
     */
    static async loadContrasts(): Promise<GrammarContrastIndex> {
        if (this.contrasts) return this.contrasts;

        try {
            const loaded = await this.fetchJson<GrammarContrastIndex>(`/data/compiled/grammar/index/contrasts.json?v=${Date.now()}`);
            this.contrasts = loaded;
            return loaded;
        } catch (e) {
            console.error('[GrammarService] Failed to load grammar contrasts; no contrast lessons will show', e);
            return {};
        }
    }

    /**
     * Contrast units keyed by their focus point id, so the intro flow can ask
     * "does the point I'm introducing carry any contrast lessons?" in one lookup.
     * Cached only once a non-empty index has actually loaded, so a transient
     * failure doesn't freeze an empty map in place.
     */
    static async loadContrastsByFocus(): Promise<Map<string, GrammarContrastForFocus[]>> {
        if (this.contrastsByFocus) return this.contrastsByFocus;

        const index = await this.loadContrasts();
        const map = new Map<string, GrammarContrastForFocus[]>();
        for (const [familyId, fam] of Object.entries(index)) {
            for (const chunk of fam.chunks) {
                for (const unit of chunk.units) {
                    const list = map.get(unit.focus) ?? [];
                    list.push({ familyId, familyName: fam.name, chunkId: chunk.id, chunkLabel: chunk.label, unit });
                    map.set(unit.focus, list);
                }
            }
        }
        if (map.size > 0) this.contrastsByFocus = map;
        return map;
    }

    /**
     * Interchangeable siblings keyed by point id: for a `variant`-axis member,
     * the OTHER members of its family that are equally interchangeable with it.
     *
     * Exists because the contrast system is otherwise silent on exactly the
     * points that most need a word said about them. A learner introduced to the
     * fourth of ten near-identical "whether A or B" forms, with no lesson and no
     * note, concludes a distinction exists and goes hunting for one. Same cache
     * discipline as loadContrastsByFocus: only cached once something loaded.
     */
    static async loadInterchangeableByPoint(): Promise<Map<string, GrammarInterchangeableForPoint>> {
        if (this.interchangeableByPoint) return this.interchangeableByPoint;

        const index = await this.loadContrasts();
        const map = new Map<string, GrammarInterchangeableForPoint>();
        for (const [familyId, fam] of Object.entries(index)) {
            const ids = fam.interchangeable ?? [];
            if (ids.length < 2) continue;
            for (const id of ids) {
                map.set(id, { familyId, familyName: fam.name, siblings: ids.filter(other => other !== id) });
            }
        }
        if (map.size > 0) this.interchangeableByPoint = map;
        return map;
    }

    /** The chapter a point belongs to, or null when the order isn't available. */
    static async loadChapterFor(pointId: string): Promise<GrammarChapter | null> {
        const order = await this.loadTeachingOrder();
        if (!order) return null;

        if (!this.chapterByPointId) {
            this.chapterByPointId = new Map();
            for (const chapter of order.chapters) {
                for (const id of chapter.points) this.chapterByPointId.set(id, chapter);
            }
        }
        return this.chapterByPointId.get(pointId) ?? null;
    }

    /**
     * Dropped-duplicate id -> canonical id. Only used by the migration pass, so
     * a failure here must not be fatal: returning {} leaves stored progress
     * untouched rather than destroying it on a transient fetch error.
     */
    static async loadAliases(): Promise<GrammarAliasIndex> {
        if (this.aliases) return this.aliases;

        try {
            this.aliases = await this.fetchJson<GrammarAliasIndex>(`/data/compiled/grammar/index/aliases.json?v=${Date.now()}`);
            return this.aliases;
        } catch (e) {
            console.error('[GrammarService] Failed to load grammar aliases; skipping id migration this run', e);
            return {};
        }
    }

    static async loadGrammarPoint(id: string): Promise<GrammarPoint> {
        if (this.pointCache.has(id)) {
            return this.pointCache.get(id)!;
        }

        const point = await this.fetchJson<GrammarPoint>(`/data/compiled/grammar/points/${id}.json`);
        this.pointCache.set(id, point);
        return point;
    }
}
