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
                    label: 'Kanji coverage (recommended)',
                    description: 'Makes the most of the kanji you know',
                },
                // Words usually written in kana (この, ここ) come only in the frequency and JLPT orders.
                { value: 'frequency', label: 'Frequency', description: 'Most common words first, including words written in kana' },
                { value: 'kklc', label: 'By kanji', description: 'Follow your kanji method, kanji words only' },
                { value: 'jlpt', label: 'JLPT level', description: 'N5 first, up to N1, including words written in kana' },
            ]}
        />
    );
}
