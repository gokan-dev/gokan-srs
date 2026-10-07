/**
 * The compiled dataset's contract, as both apps read it: the shape of every file under
 * gokan-dataset's `compiled/` that the SRS app or the dictionary loads. One copy, so the
 * two apps can never disagree about what a vocab, kanji, sentence or grammar point is.
 *
 * App-specific state (a learner's progress, settings, UI types) never lives here.
 */
export * from './vocabulary';
export * from './kanji';
export * from './sentence';
export * from './indexes';
export * from './grammar';
export * from './media';
export * from './tags';
export * from './headword';
