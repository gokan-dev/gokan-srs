import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { kanjiOrder } from "@gokan/dataset-schema";
import { useKanjiForm } from "../context/KanjiForm/useKanjiForm";
import { CONSTANTS } from "../commons/constants";
import { Button } from "./ui/Button";

interface KanjiCountStepperProps {
    /** Increment applied by the -/+ buttons (UserSettings.kanjiCountStep). */
    step?: number;
    /**
     * Persists a new increment. Omitted during setup, where there is no settings
     * object to persist into - and where the whole stepping affordance is left
     * out, since a first-time user is entering a count once, not nudging an
     * existing one by a remembered amount.
     */
    onStepChange?: (step: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Known-kanji count control. The count walks the current order and starts at 0 after a switch:
 * raising it adds that order's kanji to the known set, lowering it takes back only what this
 * visit's raises added. Kanji known before (stored, from another order, marked) stay.
 * On the profile page (both props supplied) it is the
 * raw number plus -/+ buttons moving it by the user's own increment: advancing
 * the count by a fixed amount is the main thing people come there to do (they
 * studied another N kanji elsewhere), so it should not require selecting the
 * field and doing the arithmetic by hand. During setup it degrades to the plain
 * number field.
 */
export function KanjiCountStepper({ step, onStepChange }: KanjiCountStepperProps) {
    const { state, setKanjiCount, resetKanji } = useKanjiForm();
    const [confirmingReset, setConfirmingReset] = useState(false);
    const orderLabel = kanjiOrder(state.kanjiMethod).label;

    const min = CONSTANTS.setup.minimumKanjiCount;
    // The loaded list is the real ceiling; fall back to the constant before it loads.
    const max = state.allKanji.length || CONSTANTS.setup.maximumKanjiCount;

    const stepValue = step ?? CONSTANTS.setup.defaultKanjiCountStep;
    const canStep = !!onStepChange;

    // Drafts so clearing a field mid-edit doesn't immediately snap to a clamped
    // value under the cursor. `null` means "not being edited", in which case the
    // committed value shows through - that's what lets the -/+ buttons and a
    // step restored from settings update the fields without a syncing effect.
    const [countDraft, setCountDraft] = useState<string | null>(null);
    const [stepDraft, setStepDraft] = useState<string | null>(null);

    const commitCount = (raw: string) => {
        setCountDraft(raw);
        const parsed = Number(raw);
        if (raw.trim() === '' || !Number.isFinite(parsed)) return;
        setKanjiCount(clamp(Math.floor(parsed), min, max));
    };

    const commitStep = (raw: string) => {
        setStepDraft(raw);
        const parsed = Number(raw);
        if (raw.trim() === '' || !Number.isFinite(parsed)) return;
        onStepChange?.(clamp(Math.floor(parsed), 1, CONSTANTS.setup.maximumKanjiCountStep));
    };

    const adjust = (delta: number) => {
        setCountDraft(null);
        setKanjiCount(clamp(state.kanjiCount + delta, min, max));
    };

    // Reset, Cancel and the confirm sit beside the 44px -/+ buttons: as tall on a phone, compact from md.
    const resetButtonClass = "md:h-8 md:px-3 md:text-sm";
    const knownCount = state.knownKanji.size.toLocaleString('en-US');

    const stepButtonClass =
        "h-11 min-w-16 px-3 rounded-md border border-divider bg-surface text-primary font-gothic " +
        "text-sm flex items-center justify-center gap-1 transition-colors cursor-pointer " +
        "hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface";

    return (
        <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="kanji-count" className="type-label">
                    Count in {orderLabel} order
                </label>
                <span className="type-meta tabular-nums">
                    of {max.toLocaleString('en-US')}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {canStep && (
                    <button
                        type="button"
                        onClick={() => adjust(-stepValue)}
                        disabled={state.loading || state.kanjiCount <= min}
                        className={stepButtonClass}
                        aria-label={`Remove ${stepValue} kanji`}
                    >
                        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                        {stepValue}
                    </button>
                )}

                <input
                    id="kanji-count"
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    value={countDraft ?? String(state.kanjiCount)}
                    onChange={e => commitCount(e.target.value)}
                    onBlur={() => setCountDraft(null)}
                    className={`
                        flex-1 min-w-24 h-11 border rounded-md px-4 text-lg border-divider bg-surface
                        text-primary font-gothic tabular-nums
                        ${canStep ? "text-center" : ""}
                    `.trim().replace(/\s+/g, ' ')}
                />

                {canStep && (
                    <button
                        type="button"
                        onClick={() => adjust(stepValue)}
                        disabled={state.loading || state.kanjiCount >= max}
                        className={stepButtonClass}
                        aria-label={`Add ${stepValue} kanji`}
                    >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        {stepValue}
                    </button>
                )}
            </div>

            {canStep && (
                <div className="flex items-center gap-2">
                    <label htmlFor="kanji-count-step" className="type-meta">
                        Adjust by
                    </label>
                    <input
                        id="kanji-count-step"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={CONSTANTS.setup.maximumKanjiCountStep}
                        value={stepDraft ?? String(stepValue)}
                        onChange={e => commitStep(e.target.value)}
                        onBlur={() => setStepDraft(null)}
                        className="w-16 h-8 border rounded-md px-2 text-base md:text-sm text-center border-divider bg-surface text-primary font-gothic tabular-nums"
                    />
                    <span className="type-meta">
                        kanji per click, remembered for next time
                    </span>
                </div>
            )}

            {/* The known set is a union across orders, so its size is its own number, not the count. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 min-h-11 md:min-h-8">
                <p className="type-meta tabular-nums" aria-live="polite">
                    Known: <span className="text-primary">{knownCount}</span> kanji
                </p>
                {confirmingReset ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="type-meta">
                            {state.kanjiCount === 0
                                ? `Clear all ${knownCount} known kanji?`
                                : `Keep only the first ${state.kanjiCount.toLocaleString('en-US')} of ${orderLabel}?`}
                        </span>
                        <Button variant="ghost" className={resetButtonClass} onClick={() => setConfirmingReset(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="secondary"
                            className={resetButtonClass}
                            onClick={() => { resetKanji(); setConfirmingReset(false); }}
                        >
                            Reset
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        className={resetButtonClass}
                        onClick={() => setConfirmingReset(true)}
                        disabled={state.loading}
                    >
                        Reset
                    </Button>
                )}
            </div>
        </section>
    );
}
