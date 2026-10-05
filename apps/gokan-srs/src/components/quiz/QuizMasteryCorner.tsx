import { MasteryRing } from "../MasteryRing";

/** The item's mastery ring, in the top right corner of a quiz card. */
export function QuizMasteryCorner({ memoryStrength }: { memoryStrength: number }) {
    return (
        <div className="flex justify-end mb-2">
            <MasteryRing memoryStrength={memoryStrength} size={40} />
        </div>
    );
}
