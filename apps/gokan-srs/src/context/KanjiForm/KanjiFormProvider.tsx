import React, {useCallback, useMemo, useReducer} from "react";
import { KanjiFormContext } from "./KanjiFormContext";
import type { KanjiFormState } from "./KanjiFormContext";
import type { KanjiLearningMethod } from "../../models/user.model";
import {VocabularyService} from "../../services/vocabulary.service";
import {CONSTANTS} from "../../commons/constants";
import { useAsyncData } from "../../hooks/useAsyncData";
import { countOf, initialKanjiForm, kanjiFormReducer, knownKanjiOf, knownPrefix } from "./kanjiFormReducer";

const NO_KANJI: string[] = [];

export function KanjiFormProvider({
    initialState,
    children,
}: {
    initialState: Partial<KanjiFormState>;
    children: React.ReactNode;
}) {
    const [form, dispatch] = useReducer(kanjiFormReducer, null, () => initialKanjiForm(
        initialState.kanjiMethod ?? CONSTANTS.setup.defaultKanjiLearningMethod,
        initialState.kanjiCount ?? Number(CONSTANTS.setup.defaultKanjiCount),
        initialState.knownKanji,
    ));
    const kanjiMethod = form.method;

    // The previous method's list stays up while the next one loads, so switching does not blank the
    // grid; nothing is reported or submitted while `loading` (KanjiKnowledgeEditor, SetupScreen).
    const orderLoad = useAsyncData(kanjiMethod, () => VocabularyService.loadKanjiOrder(kanjiMethod), { keepPrevious: true });
    const allKanji = orderLoad.data ?? NO_KANJI;
    const loading = orderLoad.status === 'loading';
    // Positions only mean something in the primary order's own list.
    const list = loading || !allKanji.length ? null : allKanji;

    const knownKanji = useMemo(() => knownKanjiOf(form, list), [form, list]);
    const count = countOf(form, allKanji);
    const prefix = useMemo(() => knownPrefix(allKanji, knownKanji), [allKanji, knownKanji]);

    const setKanjiCount = useCallback((next: number) => dispatch({ type: 'SET_COUNT', count: next, list }), [list]);
    const toggleKanji = useCallback((kanji: string) => dispatch({ type: 'TOGGLE', kanji, list }), [list]);
    const setKanjiMethod = useCallback((method: KanjiLearningMethod) => dispatch({ type: 'SET_METHOD', method, list }), [list]);
    const resetKanji = useCallback(() => dispatch({ type: 'RESET', list }), [list]);

    const value = useMemo(
        () => ({
            state: { allKanji, kanjiCount: count, knownPrefix: prefix, knownKanji, kanjiMethod, loading },
            setKanjiCount,
            toggleKanji,
            setKanjiMethod,
            resetKanji,
        }),
        [allKanji, count, prefix, knownKanji, kanjiMethod, loading, setKanjiCount, toggleKanji, setKanjiMethod, resetKanji]
    );

    return (
        <KanjiFormContext.Provider value={value}>
            {children}
        </KanjiFormContext.Provider>
    );
}
