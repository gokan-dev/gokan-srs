import type { GrammarAliasIndex, GrammarBrowseIndex, GrammarChapter, GrammarConjugationIndex, GrammarContrastIndex, GrammarExample, GrammarJlptIndex, GrammarKindIndex, GrammarPoint, GrammarTeachingOrder, GrammarVariantGroupIndex } from '@gokan/dataset-schema';
import type { GrammarContrastForFocus, GrammarInterchangeableForPoint } from '../models/grammar.model';
import { datasetUrl, fetchJson, readJson, RequestCache, sharedRequest } from './http';

/**
 * The teaching order, failing (so the cache drops it and a later call retries) when the file
 * is empty: loadTeachingOrder turns any failure into its JLPT fallback.
 */
async function fetchTeachingOrder(): Promise<GrammarTeachingOrder> {
    const loaded = await fetchJson<GrammarTeachingOrder>(datasetUrl('grammar/index/teaching-order.json'));
    if (!loaded?.order?.length || !loaded?.chapters?.length) throw new Error('The teaching order is empty');
    return loaded;
}

/** A point's mined examples; null (cached) on a 404, the common case of a point with none. */
async function fetchMinedExamples(pointId: string): Promise<GrammarExample[] | null> {
    const response = await fetch(datasetUrl(`grammar/mined/${pointId}.json`));
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`Failed to fetch mined examples for ${pointId}: ${response.statusText}`);
    }
    return readJson<GrammarExample[]>(response);
}

/**
 * Loads grammar data compiled by the gokan-dataset submodule's
 * scripts/build-grammar.ts into compiled/grammar/, synced into
 * public/data/compiled/grammar/ by sync-dataset.ts like every other dataset
 * (vocab, kanji, sentences). Mirrors VocabularyService's loading pattern
 * (fetch + in-memory cache) - see CLAUDE.md's Grammar section.
 */
export class GrammarService {
    private static jlptIndex = sharedRequest(() => fetchJson<GrammarJlptIndex>(datasetUrl('grammar/index/jlpt.json')));
    private static teachingOrder = sharedRequest(fetchTeachingOrder);
    private static chapterByPointId: Map<string, GrammarChapter> | null = null;
    private static aliases = sharedRequest(() => fetchJson<GrammarAliasIndex>(datasetUrl('grammar/index/aliases.json')));
    private static kinds = sharedRequest(() => fetchJson<GrammarKindIndex>(datasetUrl('grammar/index/kinds.json')));
    private static conjugations = sharedRequest(() => fetchJson<GrammarConjugationIndex>(datasetUrl('grammar/conjugations.json')));
    private static variantGroups = sharedRequest(() => fetchJson<GrammarVariantGroupIndex>(datasetUrl('grammar/index/variant-groups.json')));
    private static browseIndex = sharedRequest(() => fetchJson<GrammarBrowseIndex>(datasetUrl('grammar/index/browse.json')));
    private static contrasts = sharedRequest(() => fetchJson<GrammarContrastIndex>(datasetUrl('grammar/index/contrasts.json')));
    private static contrastsByFocus: Map<string, GrammarContrastForFocus[]> | null = null;
    private static interchangeableByPoint: Map<string, GrammarInterchangeableForPoint> | null = null;
    private static points = new RequestCache(id => fetchJson<GrammarPoint>(datasetUrl(`grammar/points/${id}.json`)));
    private static mined = new RequestCache(fetchMinedExamples);

    /** Drops every cached file, so the next load fetches it again. */
    static clearCache(): void {
        this.jlptIndex.clear();
        this.teachingOrder.clear();
        this.chapterByPointId = null;
        this.aliases.clear();
        this.kinds.clear();
        this.conjugations.clear();
        this.variantGroups.clear();
        this.browseIndex.clear();
        this.contrasts.clear();
        this.contrastsByFocus = null;
        this.interchangeableByPoint = null;
        this.points.clear();
        this.mined.clear();
    }

    static loadJlptIndex(): Promise<GrammarJlptIndex | null> {
        return this.jlptIndex.get();
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
        try {
            return await this.teachingOrder.get();
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
        try {
            return await this.kinds.get();
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
        try {
            return await this.conjugations.get();
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
        try {
            return await this.variantGroups.get();
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
        try {
            return await this.browseIndex.get();
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
        try {
            return await this.contrasts.get();
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
            for (const lesson of fam.lessons) {
                for (const case_ of lesson.cases) {
                    const list = map.get(case_.focus) ?? [];
                    list.push({ familyId, familyName: fam.name, lessonId: lesson.id, lessonTitle: lesson.title, case: case_ });
                    map.set(case_.focus, list);
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
        try {
            return await this.aliases.get();
        } catch (e) {
            console.error('[GrammarService] Failed to load grammar aliases; skipping id migration this run', e);
            return {};
        }
    }

    /**
     * Corpus-mined GrammarExample[] for a point (issue #73's app half),
     * consumed by computeBlankPlan to pick, for a REVIEW turn, the sentence
     * that best exercises the vocabulary a learner is currently trying to
     * produce - see gokan-dataset's docs/SCHEMA.md.
     *
     * A 404 is the common, permanent case (~350/828 points have no mined pool -
     * the function-word-anchor points are deferred to a later morphology pass)
     * and is cached as `null` rather than logged as an error: those points
     * simply keep curated examples forever, which is not a failure. A transient
     * fetch error is NOT cached, so it can succeed on a later retry.
     */
    static async loadMinedExamples(pointId: string): Promise<GrammarExample[] | null> {
        try {
            return await this.mined.get(pointId);
        } catch (e) {
            console.error(`[GrammarService] Failed to load mined examples for ${pointId}; falling back to curated examples`, e);
            return null;
        }
    }

    static loadGrammarPoint(id: string): Promise<GrammarPoint> {
        return this.points.get(id);
    }

    /** Several points at once, in the order asked, skipping any that fail to load (see VocabularyService.loadVocabs). */
    static async loadGrammarPoints(ids: readonly string[]): Promise<GrammarPoint[]> {
        const loaded = await Promise.all(ids.map(id => this.loadGrammarPoint(id).catch(() => null)));
        return loaded.filter((p): p is GrammarPoint => p !== null);
    }
}
