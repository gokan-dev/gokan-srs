import { QuizCardFrame } from "./quiz/QuizCardFrame";
import { CardSection } from "./ui/CardSection";
import { Button } from "./ui/Button";
import { LockOpen } from "lucide-react";

interface LearnKanjiCardProps {
    nextKanji: { step: number; kanjis: string[] };
    onUnlock: () => void;
}

export function LearnKanjiCard({ nextKanji, onUnlock }: LearnKanjiCardProps) {
    return (
        <QuizCardFrame>
            <CardSection>
                <div className="text-center space-y-4">
                    <h2 className="type-label">
                        New Kanji Unlocked
                    </h2>

                    <div className="flex flex-row justify-center items-center gap-4">
                        {nextKanji.kanjis.map((k, idx) => (
                            <span
                                key={idx}
                                className="text-primary font-mincho text-8xl md:text-9xl leading-none"
                            >
                                {k}
                            </span>
                        ))}
                    </div>

                    <p className="text-tertiary font-gothic text-sm pt-4">
                        Step {nextKanji.step}
                    </p>
                </div>
            </CardSection>

            <div className="pt-2">
                <Button
                    variant="primary"
                    className="w-full flex justify-center items-center gap-2 py-4 text-base"
                    onClick={onUnlock}
                >
                    <LockOpen size={20} />
                    Unlock and Learn Vocab
                </Button>
            </div>
        </QuizCardFrame>
    );
}
