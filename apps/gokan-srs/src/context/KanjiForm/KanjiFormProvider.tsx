import React, {useCallback, useMemo, useState} from "react";
import { KanjiFormContext } from "./KanjiFormContext";
import type { KanjiFormState } from "./KanjiFormContext";
import type { KanjiLearningMethod } from "../../models/user.model";
import {VocabularyService} from "../../services/vocabulary.service";
import {CONSTANTS} from "../../commons/constants";
import { useAsyncData } from "../../hooks/useAsyncData";

/** Flips `kanji` in a copy of `set`. */
function toggled(set: ReadonlySet<string>, kanji: string): Set<string> {
    const next = new Set(set);
    if (next.has(kanji)) next.delete(kanji);
    else next.add(kanji);
    return next;
}

const NO_KANJI: string[] = [];

export function KanjiFormProvider({
    initialState,
    children,
}: {
    initialState: Partial<KanjiFormState>;
    children: React.ReactNode;
}) {
    const [kanjiCount, setKanjiCountState] = useState<number>(initialState.kanjiCount ?? Number(CONSTANTS.setup.defaultKanjiCount));
    // Individual kanji flipped since the count last changed. The known set is derived
    // from the count plus these, rather than mirrored into state by an effect.
    const [toggledKanji, setToggledKanji] = useState<Set<string>>(new Set());
    const [kanjiMethod, setKanjiMethodState] = useState<KanjiLearningMethod>(initialState.kanjiMethod ?? CONSTANTS.setup.defaultKanjiLearningMethod);

    // The previous method's list stays up while the next one loads, so switching does not blank the
    // grid; nothing is reported or submitted while `loading` (KanjiKnowledgeEditor, SetupScreen).
    const orderLoad = useAsyncData(kanjiMethod, () => VocabularyService.loadKanjiOrder(kanjiMethod), { keepPrevious: true });
    const allKanji = orderLoad.data ?? NO_KANJI;
    const loading = orderLoad.status === 'loading';
    // A count carried over from a longer method stops at this one's end.
    const count = allKanji.length ? Math.min(kanjiCount, allKanji.length) : kanjiCount;

    // The first `kanjiCount` kanji of the method's list, with the user's individual toggles applied.
    // Until the list has loaded, the set the form was opened with.
    const knownKanji = useMemo(() => {
        if (!allKanji.length) return initialState.knownKanji ?? new Set<string>();
        let known: Set<string> = new Set(allKanji.slice(0, count));
        for (const kanji of toggledKanji) known = toggled(known, kanji);
        return known;
    }, [allKanji, count, toggledKanji, initialState.knownKanji]);

    // Moving the count starts over from the first N kanji, dropping individual toggles.
    const setKanjiCount = useCallback((next: number) => {
        if (next === count) return;
        setKanjiCountState(next);
        setToggledKanji(new Set());
    }, [count]);

    const toggleKanji = useCallback((kanji: string) => {
        setToggledKanji(prev => toggled(prev, kanji));
    }, []);

    // Another method is another list: the count carries over (the first N of the new one), the toggles do not.
    const setKanjiMethod = useCallback((method: KanjiLearningMethod) => {
        if (method === kanjiMethod) return;
        setKanjiMethodState(method);
        setToggledKanji(new Set());
    }, [kanjiMethod]);

    const value = useMemo(
        () => ({
            state: { allKanji, kanjiCount: count, knownKanji, kanjiMethod, loading },
            setKanjiCount,
            toggleKanji,
            setKanjiMethod,
        }),
        [allKanji, count, knownKanji, kanjiMethod, loading, setKanjiCount, toggleKanji, setKanjiMethod]
    );

    return (
        <KanjiFormContext.Provider value={value}>
            {children}
        </KanjiFormContext.Provider>
    );
}
