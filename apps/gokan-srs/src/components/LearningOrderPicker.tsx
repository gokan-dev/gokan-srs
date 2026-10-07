import { Sparkles } from "lucide-react";
import type { LearningOrder } from "../models/user.model";
import { OptionGrid } from "./OptionGrid";

interface LearningOrderPickerProps {
    value: LearningOrder;
    onChange: (value: LearningOrder) => void;
    dense?: boolean;
}

/** The vocabulary order choice, shared by the setup wizard and the vocab quiz settings. */
export function LearningOrderPicker({ value, onChange, dense }: LearningOrderPickerProps) {
    return (
        <OptionGrid<LearningOrder>
            title="Vocabulary order"
            dense={dense}
            value={value}
            onChange={onChange}
            options={[
                {
                    value: 'kanji_coverage',
                    label: 'Kanji Coverage Priority',
                    description: (
                        <span className="flex items-center gap-1.5 text-accent font-medium">
                            <Sparkles size={14} className="flex-shrink-0" />
                            Recommended: Efficiently covers known kanji
                        </span>
                    ),
                },
                // Words usually written in kana (この, ここ) come only in the frequency and JLPT orders.
                { value: 'frequency', label: 'Frequency', description: 'Most common words first, including words written in kana' },
                { value: 'kklc', label: 'By Kanji', description: 'Follow kanji progression, kanji words only' },
                { value: 'jlpt', label: 'JLPT Level', description: 'N5 first, up to N1, including words written in kana' },
            ]}
        />
    );
}
