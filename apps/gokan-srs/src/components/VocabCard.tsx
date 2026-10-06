import type { Vocabulary } from "@gokan/dataset-schema";
import type { VocabProgress } from "../models/vocabulary.model";
import { MasteryRing } from "./MasteryRing";
import { ProgressCard } from "./ProgressCard";
import { isProductionActivated } from "../services/scheduling";

/** A studied word in the Stats list, with one ring per direction it is trained in. */
export function VocabCard({ vocab, progress, onClick }: { vocab: Vocabulary; progress: VocabProgress; onClick?: () => void }) {
    const production = isProductionActivated(progress.production) ? progress.production : undefined;
    return (
        <ProgressCard
            progress={progress}
            onClick={onClick}
            title={
                <>
                    <div className="text-lg text-primary font-serif">{vocab.writtenForm.kanji}</div>
                    <div className="text-sm text-secondary">
                        {[vocab.reading.primary, ...vocab.reading.alternatives].join(" ・ ")}
                    </div>
                </>
            }
            rings={
                <div className="flex gap-1">
                    <div className="flex flex-col items-center" title="Reading Mastery">
                        <MasteryRing memoryStrength={progress.reading.memoryStrength} size={20} variant="reading" />
                    </div>
                    <div className="flex flex-col items-center" title="Meaning Mastery">
                        <MasteryRing memoryStrength={progress.meaning.memoryStrength} size={20} variant="meaning" />
                    </div>
                    {production && (
                        <div className="flex flex-col items-center" title="Production Mastery">
                            <MasteryRing memoryStrength={production.memoryStrength} size={20} variant="production" />
                        </div>
                    )}
                </div>
            }
            summary={vocab.senses[0]?.glosses.slice(0, 3).join(", ")}
        />
    );
}
