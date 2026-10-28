import type { Vocabulary } from "@gokan/dataset-schema";

/** How many related words a word has: what it is built from and what it is used in. */
export function relatedCount(vocab: Pick<Vocabulary, 'components' | 'parents'>): number {
    return (vocab.components?.length ?? 0) + (vocab.parents?.length ?? 0);
}
