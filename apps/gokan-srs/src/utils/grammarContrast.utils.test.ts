import { describe, it, expect } from "vitest";
import { selectKnownInterchangeableSiblings, selectReadyContrasts } from "./grammarContrast.utils";
import type { GrammarContrastForFocus } from "../models/grammar.model";

const unit = (focus: string, vs: string[]): GrammarContrastForFocus => ({
    familyId: "causality",
    familyName: "Causality",
    chunkId: "reason-core",
    chunkLabel: "から / ので",
    unit: { focus, vs, situation: "s", guidance: "g" },
});

describe("selectReadyContrasts", () => {
    it("keeps a lesson once every vs sibling is known", () => {
        const forFocus = [unit("n4-110", ["n5-073"])];
        expect(selectReadyContrasts(forFocus, new Set(["n5-073"]))).toHaveLength(1);
    });

    it("defers a lesson while any vs sibling is still unknown", () => {
        const forFocus = [unit("n4-110", ["n5-073", "n5-088"])];
        expect(selectReadyContrasts(forFocus, new Set(["n5-073"]))).toHaveLength(0);
    });

    it("filters per lesson, keeping the ready ones and dropping the rest", () => {
        const forFocus = [unit("n4-110", ["n5-073"]), unit("n4-110", ["n2-999"])];
        const ready = selectReadyContrasts(forFocus, new Set(["n5-073"]));
        expect(ready).toHaveLength(1);
        expect(ready[0].unit.vs).toEqual(["n5-073"]);
    });

    it("returns nothing for an empty input", () => {
        expect(selectReadyContrasts([], new Set(["n5-073"]))).toEqual([]);
    });
});

describe("selectKnownInterchangeableSiblings", () => {
    const entry = { familyId: "regardless-a-or-b", familyName: "Regardless", siblings: ["n1-004", "n1-006", "n1-008"] };

    it("returns only the siblings the learner has already met", () => {
        expect(selectKnownInterchangeableSiblings(entry, new Set(["n1-006", "n1-999"]))).toEqual(["n1-006"]);
    });

    it("returns nothing while no sibling is known, so the note is deferred", () => {
        // Telling someone a form is interchangeable with others they have never
        // seen is a fact about points that do not exist for them yet.
        expect(selectKnownInterchangeableSiblings(entry, new Set())).toEqual([]);
    });

    it("returns nothing for a point that is not interchangeable at all", () => {
        expect(selectKnownInterchangeableSiblings(undefined, new Set(["n1-006"]))).toEqual([]);
    });
});
