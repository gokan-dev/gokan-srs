import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { GrammarContrastIndex, GrammarPoint } from "../../models/grammar.model";
import { Card } from "../../components/ui/Card";
import { JlptChip } from "../../components/JlptChip";
import { Button } from "../../components/ui/Button";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useQuiz } from "../../context/useQuiz";
import { GrammarService } from "../../services/grammar.service";

type FamilyEntry = GrammarContrastIndex[string];

/**
 * Route /grammar/family/:familyId - the revisitable home for a near-synonym
 * family's contrast lessons (issue #62). The situational "which one, and when"
 * cards surface once at a point's introduction; this page is where a learner
 * comes back to compare the whole family deliberately, so every unit is shown
 * here regardless of what has been introduced yet.
 */
export default function GrammarFamilyScreen() {
    const { familyId } = useParams<{ familyId: string }>();
    const navigate = useNavigate();
    const { state } = useQuiz();

    // One result object keyed by the familyId it was loaded for. Loading is then
    // DERIVED (result?.familyId !== familyId) rather than set synchronously in the
    // effect, so switching families shows the loading state without a stale flash
    // and without a cascading setState-in-effect.
    const [result, setResult] = useState<{ familyId: string; entry: FamilyEntry | null; members: Map<string, GrammarPoint> } | null>(null);

    useEffect(() => {
        if (!familyId) return;
        let cancelled = false;

        GrammarService.loadContrasts().then(async index => {
            const found = index[familyId] ?? null;
            const map = new Map<string, GrammarPoint>();
            if (found) {
                const ids = Array.from(new Set([
                    ...found.chunks.flatMap(c => c.memberIds),
                    ...(found.interchangeable ?? []),
                ]));
                const loaded = await Promise.all(ids.map(id => GrammarService.loadGrammarPoint(id).catch(() => null)));
                loaded.forEach(p => { if (p) map.set(p.id, p); });
            }
            if (!cancelled) setResult({ familyId, entry: found, members: map });
        });

        return () => { cancelled = true; };
    }, [familyId]);

    const ready = result?.familyId === familyId;
    const entry = ready ? result!.entry : null;
    const members = ready ? result!.members : new Map<string, GrammarPoint>();

    const knownIds = useMemo(() => {
        const ids = new Set<string>();
        for (const g of state.progress?.grammarQueue ?? []) {
            if (g.introductionAt) ids.add(g.grammarId);
        }
        return ids;
    }, [state.progress?.grammarQueue]);

    if (!ready) return <LoadingScreen />;

    // A family with neither lessons nor interchangeable members has nothing to
    // say. One with only interchangeable members has exactly one thing to say,
    // and it is worth saying - see `interchangeable` in the model.
    if (!entry || (entry.chunks.length === 0 && (entry.interchangeable?.length ?? 0) === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 text-center">
                <div>
                    <h2 className="text-xl font-bold text-primary mb-2">No contrast lessons yet</h2>
                    <p className="text-secondary mb-4">This family does not have situational lessons authored yet.</p>
                    <Button onClick={() => navigate(-1)}>Go back</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto px-4 py-6">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 text-sm text-secondary hover:text-primary transition-colors mb-4"
            >
                <ArrowLeft size={16} /> Back
            </button>

            <h1 className="text-2xl font-serif font-semibold text-primary mb-1">{entry.name}</h1>
            <p className="text-secondary font-serif text-sm mb-6">
                {entry.chunks.length > 0
                    ? "These express the same core idea. What separates them is when to reach for each one."
                    : "These express the same core idea, and nothing reliably separates them."}
            </p>

            <div className="space-y-6">
                {entry.chunks.map(chunk => (
                    <Card key={chunk.id} size="md">
                        <h2 className="text-lg font-gothic font-semibold text-primary mb-3">{chunk.label}</h2>

                        <MemberChips ids={chunk.memberIds} members={members} knownIds={knownIds} />

                        <div className="space-y-3">
                            {chunk.units.map((unit, i) => (
                                <div key={`${chunk.id}-${i}`} className="border-l-2 border-accent/40 pl-3">
                                    <p className="text-primary font-serif text-sm leading-relaxed">
                                        <span className="font-semibold">{unit.situation}</span>{" "}
                                        {unit.guidance}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Card>
                ))}

                {entry.interchangeable && entry.interchangeable.length > 0 && (
                    <Card size="md">
                        <h2 className="text-lg font-gothic font-semibold text-primary mb-3">
                            Interchangeable
                        </h2>
                        <MemberChips ids={entry.interchangeable} members={members} knownIds={knownIds} />
                        <p className="text-primary font-serif text-sm leading-relaxed">
                            There is no rule to learn here. These forms say the same thing in the same
                            register, and choosing between them is a matter of feel rather than of fit.
                            Recognise them; do not try to work out when each one applies.
                        </p>
                    </Card>
                )}
            </div>
        </div>
    );
}

/** The family's members as links, shared by the lesson chunks and the interchangeable note. */
function MemberChips({ ids, members, knownIds }: { ids: string[]; members: Map<string, GrammarPoint>; knownIds: Set<string> }) {
    return (
        <div className="flex flex-wrap gap-2 mb-4">
            {ids.map(id => {
                const p = members.get(id);
                if (!p) return null;
                return (
                    <Link
                        key={id}
                        to={`/grammar/${id}`}
                        className="inline-flex items-center gap-2 rounded-md border border-divider px-2 py-1 hover:border-accent transition-colors"
                    >
                        <span className="font-mincho text-primary">{p.title}</span>
                        <JlptChip level={p.jlptLevel} />
                        {knownIds.has(id) && (
                            <span className="text-tertiary font-gothic text-xs">learned</span>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
