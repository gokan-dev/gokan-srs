import React, {useCallback, useEffect, useMemo, useState} from "react";
import {KanjiFormContext} from "./KanjiFormContext";
import type {KanjiFormState} from "./KanjiFormContext";
import {VocabularyService} from "../../services/vocabulary.service";
import {CONSTANTS} from "../../commons/constants";

/** Flips `kanji` in a copy of `set`. */
function toggled(set: ReadonlySet<string>, kanji: string): Set<string> {
    const next = new Set(set);
    if (next.has(kanji)) next.delete(kanji);
    else next.add(kanji);
    return next;
}

export function KanjiFormProvider({
    initialState,
    children,
}: {
    initialState: Partial<KanjiFormState>;
    children: React.ReactNode;
}) {
    const [allKanji, setAllKanji] = useState<string[]>([])
    const [kanjiCount, setKanjiCountState] = useState<number>(initialState.kanjiCount ?? Number(CONSTANTS.setup.defaultKanjiCount));
    // Individual kanji flipped since the count last changed. The known set is derived
    // from the count plus these, rather than mirrored into state by an effect.
    const [toggledKanji, setToggledKanji] = useState<Set<string>>(new Set());
    const [kanjiMethod] = useState(initialState.kanjiMethod ?? CONSTANTS.setup.defaultKanjiLearningMethod);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        VocabularyService.loadKKLCKanjiIndex().then(index => {
            if (!index) throw new Error('No index to load all kanji!');
            setAllKanji(Object.keys(index).flatMap((_, i) => index[i] ?? []));
        }).catch((error: unknown) => {
            console.error('[KanjiFormProvider] Failed to load the kanji list', error);
        }).finally(() => setLoading(false));
    }, []);

    // The first `kanjiCount` kanji of the list, with the user's individual toggles applied.
    // Until the list has loaded, the set the form was opened with.
    const knownKanji = useMemo(() => {
        if (!allKanji.length) return initialState.knownKanji ?? new Set<string>();
        let known: Set<string> = new Set(allKanji.slice(0, kanjiCount));
        for (const kanji of toggledKanji) known = toggled(known, kanji);
        return known;
    }, [allKanji, kanjiCount, toggledKanji, initialState.knownKanji]);

    // Moving the count starts over from the first N kanji, dropping individual toggles.
    const setKanjiCount = useCallback((count: number) => {
        if (count === kanjiCount) return;
        setKanjiCountState(count);
        setToggledKanji(new Set());
    }, [kanjiCount]);

    const toggleKanji = useCallback((kanji: string) => {
        setToggledKanji(prev => toggled(prev, kanji));
    }, []);

    const value = useMemo(
        () => ({
            state: { allKanji, kanjiCount, knownKanji, kanjiMethod, loading },
            setKanjiCount,
            toggleKanji,
        }),
        [allKanji, kanjiCount, knownKanji, kanjiMethod, loading, setKanjiCount, toggleKanji]
    );

    return (
        <KanjiFormContext.Provider value={value}>
            {children}
        </KanjiFormContext.Provider>
    );
}
