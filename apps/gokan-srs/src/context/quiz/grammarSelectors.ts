import type { GrammarChapter, GrammarContrastIndex, GrammarExample, GrammarExampleWord, GrammarPoint } from '@gokan/dataset-schema';
import type { GrammarProgress } from '../../models/grammar.model';
import type { UserProgress } from '../../models/user.model';
import type { SessionState } from '../../models/state.model';
import { isGrammarDue, grammarNextReviewAt, isGrammarFullyMastered } from '../../services/grammarScheduling';
import { VocabularyService } from '../../services/vocabulary.service';
import { GrammarService } from '../../services/grammar.service';
import { hashString, pickStable } from '../../utils/deterministicPick';
import { surfaceReading } from '../../utils/grammarSentence.utils';
import { indexLearnerVocab, pickMostProductive, scoreGrammarExample, wordRole } from '../../utils/sentenceRanking';
import { computeSessionState } from './sessionState';
import { markerInflections, synonymsOf, wordSlot } from '../../services/exercise/slots';
import type { MarkerToken } from '../../services/exercise/slots';
import { inferredWord, toInflectableWord } from '../../utils/inflection.utils';
import type { InflectableWord } from '../../utils/inflection.utils';
import type { AnswerSlot } from '../../services/exercise/types';
import { computeSessionStats, computeSessionPreview } from './sessionStats';
import type { QuizState } from './quizReducer';
import type { GrammarBlankPlan, PendingGrammarQuizItem } from './grammarReducer';
import { coverageOf, statusIndex, type CoverageCounts } from '../../utils/coverage.utils';

/** Grammar has no kanji-gated learning step, so 'learn-kanji' never applies here. */
// 'session-complete' is excluded alongside 'learn-kanji': the per-session quiz cap
// is a vocab concern (it exists to keep reading and meaning progressing evenly),
// and a grammar point has a single quiz type with nothing to balance against.
export type GrammarSessionState = Exclude<SessionState, 'learn-kanji' | 'session-complete'>;

export interface GrammarNextViewResult {
    queueItem: PendingGrammarQuizItem | null;
    sessionState: GrammarSessionState;
    nextReviewAt: Date | null;
    shouldShowIntro: boolean;
}

/** Grammar wrapper over the shared pickStable (utils/deterministicPick.ts): seeds on each point's per-review state so the pick reshuffles on a review or a retry flip. */
function pickStableGrammar(items: GrammarProgress[]): GrammarProgress | null {
    return pickStable(items, g => `${g.grammarId}:${g.totalReviews}:${g.needsRetry ? 1 : 0}`);
}

/**
 * Grammar's equivalent of selectNextView - single source of truth for "what
 * should the grammar screen show right now". Intro candidates take priority
 * for queueItem (mirroring vocab); sessionState is computed independently.
 */
export function selectNextGrammarView(
    state: Pick<QuizState, 'progress' | 'grammarIntroCandidates' | 'currentGrammarPoint'>,
    hasMoreLearnableGrammar: boolean,
    now: Date
): GrammarNextViewResult {
    const { progress, grammarIntroCandidates } = state;

    let queueItem: PendingGrammarQuizItem | null = null;
    if (grammarIntroCandidates.length > 0) {
        queueItem = { grammarId: grammarIntroCandidates[0].id };
    } else if (progress) {
        const dueOrRetry = progress.grammarQueue.filter(g =>
            g.stage !== 'graduated' && (isGrammarDue(g, now) || g.needsRetry)
        );
        const picked = pickStableGrammar(dueOrRetry);
        queueItem = picked ? { grammarId: picked.grammarId } : null;
    }

    const { sessionState, nextReviewAt } = computeSessionState<GrammarProgress, GrammarSessionState>(
        progress ? progress.grammarQueue : undefined,
        {
            isLearning: g => g.stage === 'learning',
            isDue: g => isGrammarDue(g, now) || !!g.needsRetry,
            nextReviewAtOf: g => grammarNextReviewAt(g),
            canLearn: hasMoreLearnableGrammar || grammarIntroCandidates.length > 0,
            states: { review: 'review', learn: 'learn', waiting: 'waiting', exhausted: 'exhausted' },
        }
    );

    let shouldShowIntro = false;
    if (state.currentGrammarPoint && progress) {
        const gp = progress.grammarQueue.find(g => g.grammarId === state.currentGrammarPoint!.id);
        shouldShowIntro = !gp || !gp.introductionAt;
    }

    return { queueItem, sessionState, nextReviewAt, shouldShowIntro };
}

function candidateIndicesOf(example: GrammarExample): number[] {
    const indices: number[] = [];
    example.words.forEach((w, i) => {
        if (w.vocabId !== null) indices.push(i);
    });
    return indices;
}

/**
 * Groups blanked word indices into the spans that become one input each.
 *
 * A contiguous run of PATTERN blanks collapses into a single span. A grammar
 * marker regularly spans several tokens - どこ/に/も is three, にしろ is two - and
 * one input per token asks the learner which box wants どこ, which wants に and
 * which wants も. That is unanswerable, and it also made the card impossible to
 * submit: Submit then required every input non-empty, so typing どこにも
 * into the first box and leaving the other two blank left the learner stuck with
 * no way forward and Reveal overwriting what they had typed.
 *
 * Vocab blanks are never merged, with each other or into a pattern run: they are
 * separate words that happen to sit side by side, and each is graded on its own.
 */
function blankSpansOf(blankIndices: number[], isPatternBlank: boolean[]): number[][] {
    const spans: number[][] = [];

    for (let i = 0; i < blankIndices.length; i++) {
        const span = [blankIndices[i]];
        if (isPatternBlank[i]) {
            while (
                i + 1 < blankIndices.length
                && isPatternBlank[i + 1]
                && blankIndices[i + 1] === blankIndices[i] + 1
            ) {
                i++;
                span.push(blankIndices[i]);
            }
        }
        spans.push(span);
    }

    return spans;
}

/** Adds `extra` to a slot's near tier, never duplicating an accepted form. */
function withNear(slot: AnswerSlot, extra: string[]): AnswerSlot {
    const near = Array.from(new Set([...slot.near, ...extra])).filter(f => !slot.accept.includes(f));
    return { ...slot, near };
}

/**
 * A marker's tokens for its slot's conjugation rule (markerInflections), each
 * conjugated token, and a verb ending the marker in its dictionary form (ことがある),
 * carrying how its word inflects: from its dictionary entry when it has one, read
 * off the token itself otherwise (inferredWord), since most marker tokens link to
 * no entry (あり for ある, し for する).
 */
async function markerTokens(words: GrammarExampleWord[]): Promise<MarkerToken[]> {
    return Promise.all(words.map(async (w, i) => {
        const kana = surfaceReading(w) ?? (/[一-鿿]/.test(w.surface) ? null : w.surface);
        const conjugated = !!w.baseForm && w.baseForm !== w.surface;
        // Unconjugated, only the marker's last token can be a verb in its dictionary form.
        const finalVerb = i === words.length - 1 && /[うくぐすつぬぶむる]$/.test(w.surface);
        if (!conjugated && !finalVerb) return { surface: w.surface, kana, word: null };
        return { surface: w.surface, kana, word: await inflectingWordOf(w) };
    }));
}

/** How a marker token's word inflects, or null when it does not (a noun). */
async function inflectingWordOf(w: GrammarExampleWord): Promise<InflectableWord | null> {
    if (w.vocabId) {
        try {
            const word = toInflectableWord(await VocabularyService.loadVocab(w.vocabId));
            return word.classes.length > 0 ? word : null;
        } catch (e) {
            console.error(`[grammarSelectors] Failed to load vocab ${w.vocabId} for a marker token, reading its conjugation off the token instead`, e);
        }
    }
    return inferredWord(w.baseForm ?? w.surface, w.surface);
}
/**
 * One answer slot per blank span, built by the exercise engine's slot builders so
 * a grammar blank accepts and grades a word exactly as a production card would,
 * up to the conjugation: a sentence blank also tests the form, so another form of
 * the right word is a near miss (`otherForm: 'minor_error'`), and the dictionary
 * forms of a conjugated occurrence (思う where the sentence needs 思っ) sit in the
 * near tier rather than the ideal one.
 *
 * Roles: when the plan blanks the pattern, its markers decide the result and the
 * vocab blanks only scale the reward, since there is one SRS entry per point and
 * it must mean grammar-point recall. With no pattern located (the fallback passes),
 * every blank decides. A marker practises the point, not the word, so its slot
 * credits no vocab, and the right construction in another conjugation is a near
 * miss on it (がありません for があります: see markerInflections).
 *
 * Vocab files are fetched here, once at load time (VocabularyService.loadVocab is
 * cached), so grading stays synchronous. A failed fetch falls back to the surface
 * and reading rather than blocking the card.
 */
async function buildBlankSlots(
    example: GrammarExample,
    blankSpans: number[][],
    // Which spans are pattern markers; omitted means none are.
    isPatternSpan: boolean[] = [],
    // The register the card asks for (its formality hint): plain for polite is right only without one.
    formalityLevel?: string
): Promise<AnswerSlot[]> {
    const registerFree = !formalityLevel || formalityLevel === 'neutral';
    const decidedByPattern = isPatternSpan.some(Boolean);
    const slots: AnswerSlot[] = [];

    for (const [spanIndex, span] of blankSpans.entries()) {
        const isPattern = !!isPatternSpan[spanIndex];
        const role = !decidedByPattern || isPattern ? 'core' : 'support';
        const words = span.map(i => example.words[i]);
        const inflections = isPattern ? markerInflections(await markerTokens(words), registerFree) : [];
        const withInflections = (slot: AnswerSlot): AnswerSlot => (inflections.length > 0 ? { ...slot, inflections } : slot);

        // A merged span is graded on the concatenation of its words. Only the
        // surface and the reading are meaningful for a multi-token marker: a
        // per-word vocab lookup would offer alternatives for one token of a marker,
        // which is not a form of anything.
        if (span.length > 1) {
            const surface = words.map(w => w.surface).join('');
            const reading = words.every(w => w.reading || !/[一-鿿]/.test(w.surface))
                ? words.map(w => w.reading ?? w.surface).join('')
                : null;
            slots.push(withInflections(
                { accept: Array.from(new Set([surface, ...(reading ? [reading] : [])])), near: [], leniency: 'standard', role, reveal: surface, gloss: '' },
            ));
            continue;
        }

        const [word] = words;
        const plain: AnswerSlot = {
            accept: Array.from(new Set([word.surface, ...(word.reading ? [word.reading] : [])])),
            near: [],
            leniency: 'standard',
            role,
            reveal: word.surface,
            gloss: '',
        };

        let slot = plain;
        if (word.vocabId) {
            try {
                const vocab = await VocabularyService.loadVocab(word.vocabId);
                slot = wordSlot(vocab, {
                    ...(isPattern ? {} : { vocabId: word.vocabId }),
                    // Gated on `baseForm`, which the dataset sets only when the base form
                    // differs from the surface: writing 寿司 as すし stays fully correct.
                    occurrence: { surface: word.surface, reading: word.reading, inflected: !!word.baseForm },
                    otherForm: 'minor_error',
                    role,
                    // A word blank grades a near-synonym against the sentence exactly as a
                    // production card does. A marker is the point's own form: another word
                    // in its place is simply wrong.
                    synonyms: isPattern ? [] : synonymsOf(vocab),
                });
            } catch (e) {
                console.error(`[grammarSelectors] Failed to load vocab ${word.vocabId} for blank ${span[0]}, falling back to surface/reading only`, e);
                if (!isPattern) slot = { ...plain, word: { vocabId: word.vocabId, label: word.surface, headword: word.baseForm ?? word.surface, lemma: null, otherForm: 'minor_error', synonyms: [] } };
            }
        }
        slots.push(withInflections(slot));
    }

    return slots;
}

/** The single most-frequent (lowest frequency.kanjiRank) candidate word in an example, used for the one-blank fallback (item 5.2). Falls back to the first candidate if every fetch fails. */
async function pickMostFrequentCandidate(example: GrammarExample, candidateIndices: number[]): Promise<number> {
    let best = candidateIndices[0];
    let bestRank = Infinity;

    for (const i of candidateIndices) {
        const vocabId = example.words[i].vocabId;
        if (!vocabId) continue;
        try {
            const vocab = await VocabularyService.loadVocab(vocabId);
            if (vocab.frequency.kanjiRank < bestRank) {
                bestRank = vocab.frequency.kanjiRank;
                best = i;
            }
        } catch (e) {
            console.error(`[grammarSelectors] Failed to load vocab ${vocabId} while ranking candidates for the single-blank fallback`, e);
        }
    }

    return best;
}

/**
 * Picks the example sentence for the CURRENT review turn and decides which of
 * its words become blanks. The grammar CONSTRUCTION is the primary thing this
 * quiz tests, not vocabulary that happens to sit in the sentence - there is
 * one SRSEntry per grammar point, so what gets graded has to consistently
 * reflect grammar-point recall, or the schedule that entry drives doesn't
 * mean what it claims to. Four passes, each preferred over the next:
 *
 * 1. PRIMARY - an example whose grammar-pattern markers were located at
 *    dataset build time (`example.patternWordIndices`, non-empty - see
 *    docs/SCHEMA.md in gokan-dataset). Blank those markers unconditionally,
 *    regardless of vocab knowledge - this is what makes review of the point
 *    actually test the point. Examples are walked in a deterministic-but-
 *    varying order (hashed on grammar point id + review count) so repeated
 *    reviews of the same point cycle through different examples without
 *    re-rolling on every recompute of the same turn. Any OTHER content word
 *    in that same example the user already knows (introduced in
 *    learningQueue) is layered in as SECONDARY reinforcement - vocab recall
 *    stays part of the exercise, just never at the expense of the pattern.
 * 2. FALLBACK - the pattern isn't locatable in any of the point's examples
 *    (rare: ~1.9% of points as of the dataset's last build, all conjugation-
 *    transformation-style points with no literal marker in common across
 *    their own examples - see the gokan-dataset pattern-location issue).
 *    An example with at least one known word, blanking every known word in it
 *    - this is the ORIGINAL vocab-only behavior, demoted to a fallback for
 *    the residual the primary path can't cover.
 * 3. FALLBACK - no example has a known word either (a learner very early in
 *    vocab, on one of these rare pattern-less points): blank exactly the
 *    single most frequent candidate word, so there is still something to
 *    answer rather than an unanswerable all-blank card.
 * 4. No example has any blankable word at all - return a read-only plan
 *    (blankWordIndices: []) so the card renders as pure study material with
 *    no Submit step, rather than silently auto-granting SRS credit for an
 *    empty answer.
 */
const KANA = /[぀-ヿ]/;

/**
 * The dataset's form label with the kana parts of its parentheticals removed,
 * since those spell out the ending being asked for: "past negative (じゃなかった)"
 * becomes "past negative". English parts stay, they name the form without giving
 * it away: "prohibitive (な / do not)" becomes "prohibitive (do not)".
 */
export function cueFormLabel(label: string): string {
    return label.replace(/\s*\(([^)]*)\)/g, (_, inner: string) => {
        const kept = inner.split('/').map(part => part.trim()).filter(part => part && !KANA.test(part));
        return kept.length > 0 ? ` (${kept.join(' / ')})` : '';
    }).trim();
}

/**
 * Builds the drill plan for an `inflection` point - a point whose identity is a
 * derivation (て-form, causative, passive), so there is no invariant marker for
 * the cloze quiz to blank.
 *
 * Returns null when the dataset has no drill items for the point, which is
 * deliberate rather than defensive: `GrammarSRSService` keeps such a point out
 * of the introduction pipeline entirely, so reaching here without items would
 * mean serving an unanswerable card.
 *
 * The item is picked deterministically from the point's own list, seeded the
 * same way computeBlankPlan picks an example, so a recompute of the same turn is
 * stable while successive reviews cycle through different verbs.
 */
export async function computeConjugationPlan(point: GrammarPoint, reviewCount: number): Promise<GrammarBlankPlan | null> {
    const conjugations = await GrammarService.loadConjugations();
    const entry = conjugations[point.id];
    if (!entry || entry.items.length === 0) return null;

    const index = hashString(`${point.id}:${reviewCount}`) % entry.items.length;
    const item = entry.items[index];

    // Kana and kanji both accepted, plus whatever the dataset marked as an
    // equally correct alternative (書かされる for the causative-passive, the
    // colloquial 食べれる for the ichidan potential).
    const accepted = Array.from(new Set([item.target, item.targetReading, ...(item.alternatives ?? [])].filter(Boolean)));

    return {
        // No sentence is involved; 0 keeps the field well-formed for any consumer
        // that indexes examples without checking `conjugation` first.
        exampleIndex: 0,
        blankWordIndices: [0],
        blankWordSpans: [[0]],
        slots: [{
            accept: accepted,
            near: [],
            // Its answers are whole conjugated forms, where a missed key is a slip.
            leniency: 'lenient',
            // The derivation IS the point, so this slot decides the point's result.
            role: 'core',
            reveal: accepted[0] ?? '',
            // The cue label, never the dataset's: its kana parenthetical is the answer.
            gloss: cueFormLabel(entry.formLabel),
            // No word: the form is what is tested, so another form of the right
            // word stays wrong here (大変じゃない for 大変じゃなくて).
        }],
        readOnly: false,
        conjugation: {
            lemma: item.lemma,
            lemmaReading: item.lemmaReading,
            formLabel: cueFormLabel(entry.formLabel),
            wordClass: item.wordClass,
            target: item.target,
            targetReading: item.targetReading,
            // Written forms only - the kana of each alternative is already in
            // `accepted`, and listing both spellings of each would read as four
            // answers rather than two.
            ...(item.alternatives?.length
                ? { alternatives: item.alternatives.filter(a => a !== item.targetReading && /[一-鿿]/.test(a)) }
                : {}),
        },
    };
}

/**
 * For a canonical point that heads a variant group, swaps in one realization for
 * this turn and widens the accept-list to the rest of the group.
 *
 * The realization rotates on `reviewCount`, so a learner meets どこにも, どこへも
 * and どこも over successive reviews instead of grinding six separate points for
 * one rule. Mastery stays on the canonical's single SRS entry.
 *
 * Grading follows the relation, because the two axes are not equally strict:
 *  - a sibling differing only by PARTICLE (に / へ / none) is genuinely
 *    interchangeable, so it grades `correct`
 *  - a sibling differing in POLITENESS is the wrong register for the hint the
 *    card showed, so it grades `minor_error` - a near miss, not a failure
 */
async function applyVariantRotation(
    canonical: GrammarPoint,
    reviewCount: number
): Promise<{ point: GrammarPoint; realization: NonNullable<GrammarBlankPlan['realization']>; sameRegister: string[]; otherRegister: string[] } | null> {
    const groups = await GrammarService.loadVariantGroups();
    const members = groups[canonical.id];
    if (!members || members.length < 2) return null;

    const index = hashString(`${canonical.id}:variant:${reviewCount}`) % members.length;
    const chosen = members[index];

    const point = chosen.id === canonical.id
        ? canonical
        : await GrammarService.loadGrammarPoint(chosen.id).catch(() => null);
    if (!point) return null;

    // Every other realization's own pattern text, split by whether it shares the
    // chosen realization's register.
    const sameRegister: string[] = [];
    const otherRegister: string[] = [];
    for (const member of members) {
        if (member.id === chosen.id) continue;
        const sibling = member.id === canonical.id
            ? canonical
            : await GrammarService.loadGrammarPoint(member.id).catch(() => null);
        if (!sibling) continue;

        for (const example of sibling.examples) {
            if (example.patternWordIndices.length === 0) continue;

            // Only widen with a CONTIGUOUS span. A gap means the words do not
            // concatenate into a string that appears anywhere: n5-104's anchor is
            // どこ|に|も ... です, spanning the verb, and joining it yields
            // どこにもです - not a form of anything.
            //
            // This replaces a guard that skipped any span containing a
            // vocab-linked word. That was written when n5-104 still anchored
            // どこにも売ってないです and the span really had swallowed a content
            // word - gokan-dev/gokan-dataset#21 fixed that. Afterwards the guard
            // matched EVERY span in EVERY group, because どこ and だれ are
            // themselves vocab entries (何処, 誰), so the accept-list widening
            // silently did nothing at all: typing どこへも when shown どこにも
            // graded plain wrong.
            const indices = example.patternWordIndices;
            const contiguous = indices.every((wordIndex, k) => k === 0 || wordIndex === indices[k - 1] + 1);
            if (!contiguous) continue;

            const surface = example.patternWordIndices.map(i => example.words[i]?.surface ?? '').join('');
            if (!surface) continue;
            (member.formalityLevel === chosen.formalityLevel ? sameRegister : otherRegister).push(surface);
        }
    }

    return {
        point,
        realization: {
            pointId: chosen.id,
            canonicalId: canonical.id,
            index: index + 1,
            total: members.length,
            formalityLevel: point.formalityLevel,
        },
        sameRegister: Array.from(new Set(sameRegister)),
        otherRegister: Array.from(new Set(otherRegister)),
    };
}

/**
 * Widens a pattern blank to accept a near-synonym family sibling in place of the
 * expected marker, graded by how close the two are (issue #62's interchangeability).
 *
 * Unlike a variant-group realization, a family sibling is NOT guaranteed to be
 * slot-compatible: けど (clause-final) and でも (sentence-initial) share the "but"
 * family but occupy different syntactic slots, and でも in a clause-final blank is
 * ungrammatical. So a sibling is only offered when it fills the SAME `slot`, and:
 *  - a `constraint`-axis sibling carries a real semantic restriction, so
 *    substituting it changes the meaning - excluded (grades wrong).
 *  - a `register`/`variant` sibling is offered, tiered by formality exactly as the
 *    variant rotation does: same register -> `correct`, different -> `minor_error`.
 *
 * Marker surfaces come from each sibling's own examples (contiguous pattern span),
 * the same extraction applyVariantRotation uses.
 */
async function applyFamilyInterchange(point: GrammarPoint): Promise<{ sameRegister: string[]; otherRegister: string[] } | null> {
    const family = point.family;
    if (!family || !point.slot || family.relatedPoints.length === 0) return null;

    const sameRegister: string[] = [];
    const otherRegister: string[] = [];

    for (const siblingId of family.relatedPoints) {
        const sibling = await GrammarService.loadGrammarPoint(siblingId).catch(() => null);
        if (!sibling) continue;
        // Same slot only - otherwise the substitution is ungrammatical, not a near miss.
        if (!sibling.slot || sibling.slot !== point.slot) continue;
        // constraint siblings change the meaning; only register/variant siblings are interchangeable.
        const axis = sibling.family?.axis;
        if (axis !== 'register' && axis !== 'variant') continue;

        for (const example of sibling.examples) {
            if (example.patternWordIndices.length === 0) continue;
            const indices = example.patternWordIndices;
            const contiguous = indices.every((w, k) => k === 0 || w === indices[k - 1] + 1);
            if (!contiguous) continue;
            const surface = indices.map(i => example.words[i]?.surface ?? '').join('');
            if (!surface) continue;
            (sibling.formalityLevel === point.formalityLevel ? sameRegister : otherRegister).push(surface);
        }
    }

    return { sameRegister: Array.from(new Set(sameRegister)), otherRegister: Array.from(new Set(otherRegister)) };
}

/**
 * Productivity-selected sentence for a REVIEW turn (issue #73's app half,
 * extended in issue #85 to let curated examples compete on equal terms):
 * ranks the point's curated examples that already have a located pattern
 * together with its corpus-mined pool, and picks whichever is most
 * comprehensible - fewest/lightest unknown words, then shortest, then most
 * productive - rather than a mined sentence always winning outright whenever
 * one qualifies. The intro card and the very first review (reviewCount === 0,
 * gated by the caller) stay on curated examples only - they are hand-picked
 * and clean, which matters most for a first encounter.
 *
 * The sentence is chosen by the shared ranker (utils/sentenceRanking.ts), the
 * same rule the vocab cards use: unknown weight, then length band, then most
 * target words (known, production ring below the ceiling), then the highest
 * summed production ring, then a stable per-sentence hash. The ranking is
 * deterministic and seeded on the point id alone, so the same sentence keeps
 * coming back until its words mature, which is the point: familiarity with a
 * sentence is shared with the vocab cards drawing from the same corpus.
 *
 * A curated example with no located pattern is not a candidate here at all -
 * it cannot be blanked on the pattern, and the caller's fallback chain
 * (computeBlankPlanFor) already knows how to handle that case. Pattern-marker
 * words are excluded from the vocab scoring on both sources (they are blanked
 * regardless, as the grammar under test). Only sentences with at least one
 * target are eligible: a sentence that only drills mature vocab has nothing to
 * offer over any other. Returns null - the caller falls back to
 * `computeBlankPlanFor`'s own curated passes - when neither source has a
 * candidate with a target at all.
 */
async function selectProductivePlan(
    point: GrammarPoint,
    progress: UserProgress | null
): Promise<GrammarBlankPlan | null> {
    const mined = await GrammarService.loadMinedExamples(point.id);
    const learner = indexLearnerVocab(progress?.learningQueue);

    const curatedCandidates = point.examples.filter(e => e.patternWordIndices.length > 0);
    const candidateExamples = [...curatedCandidates, ...(mined ?? [])];
    if (candidateExamples.length === 0) return null;

    const candidates = candidateExamples.map(example => {
        const score = scoreGrammarExample(example, learner);
        const targets = example.words.flatMap((word, i) =>
            word.vocabId && !example.patternWordIndices.includes(i) && wordRole(word.vocabId, learner) === 'target' ? [i] : []);
        return { example, score, targets };
    }).filter(c => c.score.targets > 0);

    const chosen = pickMostProductive(candidates, c => c.score, c => c.example.jp, point.id);
    if (!chosen) return null;

    // Blanks: the pattern markers plus every target word, sorted by position -
    // the same reinforcement mechanism Pass 1 uses, just sourced from the
    // productivity targets instead of "every known word".
    const blankedIndices = Array.from(new Set([...chosen.example.patternWordIndices, ...chosen.targets])).sort((a, b) => a - b);
    const isPatternArr = blankedIndices.map(i => chosen.example.patternWordIndices.includes(i));
    const blankWordSpans = blankSpansOf(blankedIndices, isPatternArr);
    const blankWordIndices = blankWordSpans.map(span => span[0]);
    const isPatternBlank = blankWordIndices.map(i => chosen.example.patternWordIndices.includes(i));

    const slots = await buildBlankSlots(chosen.example, blankWordSpans, isPatternBlank, point.formalityLevel);

    // The chosen example may come from either source - report whichever index
    // is meaningful. `example` is what every consumer actually reads (see
    // GrammarBlankPlan.example's doc comment), so exampleIndex here is
    // informational only.
    const curatedIndex = point.examples.indexOf(chosen.example);

    return {
        exampleIndex: curatedIndex !== -1 ? curatedIndex : (mined?.indexOf(chosen.example) ?? -1),
        example: chosen.example,
        blankWordIndices,
        blankWordSpans,
        slots,
        readOnly: false,
    };
}

export async function computeBlankPlan(point: GrammarPoint, progress: UserProgress | null, reviewCount: number): Promise<GrammarBlankPlan | null> {
    // An inflection point cannot be tested by blanking a marker - hand it to the
    // conjugation drill. Falls through to the cloze path when the dataset has no
    // items, so a partially-built dataset degrades rather than breaking.
    if (point.kind === 'inflection') {
        const conjugationPlan = await computeConjugationPlan(point, reviewCount);
        if (conjugationPlan) return conjugationPlan;
    }

    // A canonical heading a variant group drills one realization per turn.
    const rotation = await applyVariantRotation(point, reviewCount);
    const effectivePoint = rotation?.point ?? point;

    if (effectivePoint.examples.length === 0) return null;

    // Reviews only (reviewCount >= 1): the intro card and the first review stay
    // on curated examples. See selectProductivePlan's doc comment for the full rule.
    const productivePlan = reviewCount >= 1 ? await selectProductivePlan(effectivePoint, progress) : null;
    const base = productivePlan ?? await computeBlankPlanFor(effectivePoint, progress, reviewCount);
    if (!base) return null;

    // Two independent sources widen the PATTERN blanks: the variant-group rotation
    // (same construction, different realization) and family interchange (a
    // near-synonym sibling filling the same slot). They stack.
    const interchange = await applyFamilyInterchange(point);
    const sameRegister = [...(rotation?.sameRegister ?? []), ...(interchange?.sameRegister ?? [])];
    const otherRegister = [...(rotation?.otherRegister ?? []), ...(interchange?.otherRegister ?? [])];

    // Nothing to add and no realization to record: the base plan stands unchanged.
    if (!rotation && sameRegister.length === 0 && otherRegister.length === 0) return base;

    const patternWordIndices = base.example?.patternWordIndices ?? [];
    return {
        ...base,
        ...(rotation ? { realization: rotation.realization } : {}),
        // Widen only the PATTERN blanks: a vocab blank has nothing to do with the
        // alternation and must keep grading strictly. A same-register sibling is
        // interchangeable; another register is the wrong one for the hint shown.
        slots: base.slots.map((slot, i) => {
            if (!patternWordIndices.includes(base.blankWordIndices[i])) return slot;
            const accept = Array.from(new Set([...slot.accept, ...sameRegister]));
            return withNear({ ...slot, accept }, otherRegister);
        }),
    };
}

async function computeBlankPlanFor(point: GrammarPoint, progress: UserProgress | null, reviewCount: number): Promise<GrammarBlankPlan | null> {
    if (point.examples.length === 0) return null;

    const startIndex = hashString(`${point.id}:${reviewCount}`) % point.examples.length;
    const order = Array.from({ length: point.examples.length }, (_, i) => (startIndex + i) % point.examples.length);

    const isKnown = (vocabId: string): boolean => {
        if (!progress) return false;
        const vp = progress.learningQueue.find(v => v.vocabId === vocabId);
        return !!vp && vp.introductionAt !== null;
    };

    // Pass 1: PRIMARY - an example whose grammar-pattern markers are located.
    for (const exampleIndex of order) {
        const example = point.examples[exampleIndex];
        if (example.patternWordIndices.length === 0) continue;

        const candidateIndices = candidateIndicesOf(example);
        const knownVocabIndices = candidateIndices.filter(
            i => !example.patternWordIndices.includes(i) && isKnown(example.words[i].vocabId!)
        );
        const blankedIndices = [...example.patternWordIndices, ...knownVocabIndices].sort((a, b) => a - b);
        const blankWordSpans = blankSpansOf(
            blankedIndices,
            blankedIndices.map(i => example.patternWordIndices.includes(i))
        );
        const blankWordIndices = blankWordSpans.map(span => span[0]);
        const isPatternBlank = blankWordIndices.map(i => example.patternWordIndices.includes(i));

        const slots = await buildBlankSlots(example, blankWordSpans, isPatternBlank, point.formalityLevel);
        return { exampleIndex, example, blankWordIndices, blankWordSpans, slots, readOnly: false };
    }

    // Pass 2: FALLBACK - pattern not locatable anywhere in this point; an example with a known word.
    for (const exampleIndex of order) {
        const example = point.examples[exampleIndex];
        const candidateIndices = candidateIndicesOf(example);
        if (candidateIndices.length === 0) continue;

        const knownIndices = candidateIndices.filter(i => isKnown(example.words[i].vocabId!));
        if (knownIndices.length > 0) {
            // No pattern located, so every blank decides the result (worst-of), the
            // original pre-pattern behaviour.
            const slots = await buildBlankSlots(example, knownIndices.map(i => [i]));
            return { exampleIndex, example, blankWordIndices: knownIndices, blankWordSpans: knownIndices.map(i => [i]), slots, readOnly: false };
        }
    }

    // Pass 3: FALLBACK - no known vocab either; blank the single most frequent candidate.
    for (const exampleIndex of order) {
        const example = point.examples[exampleIndex];
        const candidateIndices = candidateIndicesOf(example);
        if (candidateIndices.length === 0) continue;

        const best = await pickMostFrequentCandidate(example, candidateIndices);
        const slots = await buildBlankSlots(example, [[best]]);
        return { exampleIndex, example, blankWordIndices: [best], blankWordSpans: [[best]], slots, readOnly: false };
    }

    // Pass 4: no example has any blankable word at all - read-only study material.
    return { exampleIndex: startIndex, example: point.examples[startIndex], blankWordIndices: [], blankWordSpans: [], slots: [], readOnly: true };
}

export function selectCurrentGrammarProgress(
    state: Pick<QuizState, 'currentGrammarPoint' | 'progress'>
): GrammarProgress | null {
    if (!state.currentGrammarPoint || !state.progress) return null;
    return state.progress.grammarQueue.find(g => g.grammarId === state.currentGrammarPoint!.id) ?? null;
}

/** Every grammar point actionable right now (due, or awaiting a retry), as grammar ids - grammar's equivalent of collectActionableTaskKeys. */
export function collectActionableGrammarIds(queue: GrammarProgress[], now: Date): string[] {
    return queue
        .filter(g => g.stage !== 'graduated' && (isGrammarDue(g, now) || g.needsRetry))
        .map(g => g.grammarId);
}

export interface GrammarSessionStats {
    /** Committed session points the user has cleared (answered, deferred, or graduated out). */
    done: number;
    /** Size of the committed session set - the stable progress denominator. */
    total: number;
    /** Committed points currently awaiting a retry (a wrong answer this session). */
    retriesPending: number;
    /** Grammar points due now that are NOT part of this session (came due mid-session). */
    waiting: number;
    /** True when brand-new grammar points can still be learned beyond this session. */
    moreNew: boolean;
}

/**
 * Grammar's equivalent of selectSessionStats - progress bookkeeping computed
 * against the session's frozen committed set rather than the live due count,
 * for the same reason vocab's counter needed one (see selectSessionStats's
 * doc comment). Simpler here: one task per grammar point, no reading/meaning
 * split, so there's no staggering to account for.
 */
export function selectGrammarSessionStats(
    state: Pick<QuizState, 'progress' | 'grammarSession'>,
    hasMoreLearnableGrammar: boolean,
    now: Date
): GrammarSessionStats {
    if (!state.progress) {
        return { done: 0, total: 0, retriesPending: 0, waiting: 0, moreNew: hasMoreLearnableGrammar };
    }

    const byId = new Map(state.progress.grammarQueue.map(g => [g.grammarId, g]));

    const core = computeSessionStats({
        committed: state.grammarSession?.committed ?? [],
        actionable: collectActionableGrammarIds(state.progress.grammarQueue, now),
        isRetry: id => byId.get(id)?.needsRetry === true,
        // One key per point already, so the waiting count is just distinct ids.
        waitingCountOf: keys => new Set(keys).size,
    });

    return { ...core, moreNew: hasMoreLearnableGrammar };
}

export interface NextGrammarSessionPreview {
    review: number;
    new: number;
    retries: number;
}

/** Preview of the next grammar session's contents, mirroring selectNextSessionPreview - shown on the Main hub's grammar activity card. */
export function selectNextGrammarSessionPreview(
    state: Pick<QuizState, 'progress'>,
    now: Date
): NextGrammarSessionPreview {
    if (!state.progress) return { review: 0, new: 0, retries: 0 };

    return computeSessionPreview(state.progress.grammarQueue, {
        isGraduated: g => g.stage === 'graduated',
        isRetry: g => !!g.needsRetry,
        isNew: g => g.totalReviews === 0,
        isDue: g => isGrammarDue(g, now),
    });
}

/**
 * Every id, in a stable order, that is the FOCUS of a contrast case belonging
 * to a lesson anchored to `chapterId` (lesson.taughtInChapterId). This is the
 * set of points the end-of-chapter review step renders - one GrammarContrastCard
 * per id, reusing exactly the same component the per-point intro-time card
 * uses (see GrammarChapterLessonCard). Pure and testable independent of the
 * async data loading that supplies `contrasts`.
 *
 * Deliberately collects by FOCUS point rather than by lesson: GrammarContrastCard
 * already resolves "every ready case for this point" on its own via
 * selectReadyContrasts, so handing it one id per focus is enough - no need to
 * pass case-level detail through this selector.
 */
export function selectChapterEndFocusIds(contrasts: GrammarContrastIndex, chapterId: string): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];

    for (const family of Object.values(contrasts)) {
        for (const lesson of family.lessons) {
            if (lesson.taughtInChapterId !== chapterId) continue;
            for (const c of lesson.cases) {
                if (seen.has(c.focus)) continue;
                seen.add(c.focus);
                ids.push(c.focus);
            }
        }
    }

    return ids;
}

/**
 * Chapters that have just become fully introduced (every TEACHABLE point in
 * the chapter has introductionAt set) and are not already in
 * `completedChapters`. "Teachable" mirrors GrammarSRSService's own gate: a
 * chapter containing an inflection point with no conjugation drill items can
 * never have that point introduced, so requiring it would strand the chapter
 * incomplete forever.
 *
 * Pure - `isTeachable` is passed in rather than fetched here, so this can be
 * tested without mocking GrammarService. Order follows `chapters`, so when
 * more than one completes in the same tick (e.g. after a Drive merge brings in
 * a large chunk of remote progress at once) they are handled in curriculum
 * order.
 */
export function selectNewlyCompletedChapterIds(
    chapters: GrammarChapter[],
    grammarQueue: GrammarProgress[],
    completedChapters: string[],
    isTeachable: (id: string) => boolean
): string[] {
    const introducedIds = new Set(grammarQueue.filter(g => g.introductionAt !== null).map(g => g.grammarId));
    const completed = new Set(completedChapters);

    return chapters
        .filter(chapter => !completed.has(chapter.id))
        .filter(chapter => chapter.points.every(id => !isTeachable(id) || introducedIds.has(id)))
        .map(chapter => chapter.id);
}

/** Three-way point tally for one chapter: mastered / in-progress (introduced, not mastered) / total. */
export type GrammarChapterProgressCounts = CoverageCounts;

/**
 * A chapter's own progress, counted over its member points - the same
 * three-way split GrammarJlptCoverageChart already uses per JLPT level, here
 * scoped to one chapter instead. Used by the Main hub's chapter progress bar
 * and the chapter browser's per-chapter rows (issue #58).
 *
 * A point not yet in `grammarQueue` at all (never introduced) counts as
 * untouched, same as one with `introductionAt: null` - both simply fail both
 * the mastered and learning checks below.
 */
export function computeGrammarChapterProgress(
    chapter: GrammarChapter,
    grammarQueue: GrammarProgress[]
): GrammarChapterProgressCounts {
    // Only an introduced point counts as started; a queued one not yet met is untouched.
    const status = statusIndex(grammarQueue, g => g.grammarId, g =>
        !g.introductionAt ? undefined : isGrammarFullyMastered(g) ? 'mastered' : 'learning');
    return coverageOf(chapter.points, status);
}

/**
 * Status for the Main hub's grammar chapter line + progress bar (issue #87):
 * the CURRENT chapter (has at least one introduced point), the NEXT one
 * (none introduced yet), or COMPLETE (nothing left to introduce, counted
 * over the whole curriculum). Always derived from the teaching order and the
 * queue - it replaced an earlier version gated on `preview.new > 0`, which
 * only ever counts points queued-but-never-reviewed and hit zero the moment
 * a learner reviewed every introduced point at least once (the ordinary
 * state BETWEEN chapters), hiding the chapter line and bar even though a
 * chapter was genuinely in progress or a next one was waiting.
 */
export type HubChapterStatus =
    | { status: 'current'; chapterNumber: number; chapterTitle: string; counts: GrammarChapterProgressCounts }
    | { status: 'next'; chapterNumber: number; chapterTitle: string; counts: GrammarChapterProgressCounts }
    | { status: 'complete'; totalChapters: number; counts: GrammarChapterProgressCounts };

/**
 * Derives the hub's chapter status from `GrammarSRSService.getCurrentChapter()`'s
 * result and the queue - pure and testable independent of the async chapter
 * lookup itself. `chapters` is the full teaching order's chapter list (used
 * only for `chapterNumber`, its 1-based position among all chapters - the
 * same numbering `GrammarDetailScreen`'s locator uses - and, for the
 * `'complete'` case, to build a synthetic whole-curriculum chapter via
 * `computeGrammarChapterProgress`).
 *
 * `currentChapter === null` means the curriculum is fully introduced (see
 * `getCurrentChapter`'s own doc comment) - it means the SAME thing when the
 * teaching order failed to load, which this function cannot tell apart on
 * its own. The caller is responsible for that distinction: only call this
 * once `GrammarService.loadTeachingOrder()` itself succeeded, and render
 * nothing otherwise (mirroring the pre-existing fallback behaviour).
 *
 * `current` vs `next` is read off `counts` rather than re-scanning the queue:
 * `computeGrammarChapterProgress` already counts a chapter's introduced
 * points as mastered/learning, so "at least one introduced" is exactly
 * `mastered + learning > 0`.
 */
export function describeHubChapter(
    chapters: GrammarChapter[],
    currentChapter: GrammarChapter | null,
    grammarQueue: GrammarProgress[]
): HubChapterStatus {
    if (!currentChapter) {
        const wholeCurriculum: GrammarChapter = {
            id: '__hub-complete__',
            title: '',
            summary: '',
            jlptLevel: 0,
            points: chapters.flatMap(c => c.points),
        };
        return {
            status: 'complete',
            totalChapters: chapters.length,
            counts: computeGrammarChapterProgress(wholeCurriculum, grammarQueue),
        };
    }

    const counts = computeGrammarChapterProgress(currentChapter, grammarQueue);

    return {
        status: counts.mastered + counts.learning > 0 ? 'current' : 'next',
        chapterNumber: chapters.indexOf(currentChapter) + 1,
        chapterTitle: currentChapter.title,
        counts,
    };
}

/** Ids of every grammar point already introduced to the learner, whatever its mastery. */
export function selectIntroducedGrammarIds(grammarQueue: readonly GrammarProgress[]): Set<string> {
    const ids = new Set<string>();
    for (const g of grammarQueue) {
        if (g.introductionAt) ids.add(g.grammarId);
    }
    return ids;
}
