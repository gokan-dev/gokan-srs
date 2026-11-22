import type { GrammarContrastCase } from "@gokan/dataset-schema";
import { MixedText } from "./MixedText";

/**
 * A contrast case (when to pick which of similar points), drawn the same on a family page and
 * under a drill card: the situation in semibold, then the guidance, each Japanese run of both in
 * a Japanese face (MixedText). `label`: a heading inside the block, the drill's.
 */
export function ContrastCaseText({ contrast, label, className = "" }: {
    contrast: Pick<GrammarContrastCase, "situation" | "guidance">;
    label?: string;
    className?: string;
}) {
    return (
        <div className={`border-l-2 border-accent/40 pl-3 ${className}`}>
            {label && <p className="type-label mb-1">{label}</p>}
            <p className="text-primary font-sans text-sm leading-relaxed">
                <span className="font-semibold"><MixedText text={contrast.situation} /></span>{" "}
                <MixedText text={contrast.guidance} />
            </p>
        </div>
    );
}
