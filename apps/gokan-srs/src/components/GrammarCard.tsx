import type { GrammarPoint } from "@gokan/dataset-schema";
import type { GrammarProgress } from "../models/grammar.model";
import { MasteryRing } from "./MasteryRing";
import { JlptChip } from "./JlptChip";
import { ProgressCard } from "./ProgressCard";

/** Grammar's equivalent of VocabCard, for SmartGrammarList's grid. */
export function GrammarCard({ point, progress, onClick }: { point: GrammarPoint; progress: GrammarProgress; onClick?: () => void }) {
    return (
        <ProgressCard
            progress={progress}
            onClick={onClick}
            title={
                <>
                    <div className="text-lg text-primary font-mincho">{point.title}</div>
                    <div className="mt-1"><JlptChip level={point.jlptLevel} /></div>
                </>
            }
            rings={<MasteryRing memoryStrength={progress.entry.memoryStrength} size={28} />}
            summary={point.shortExplanation}
        />
    );
}
