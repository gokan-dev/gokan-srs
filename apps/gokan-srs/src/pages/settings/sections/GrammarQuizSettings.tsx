/**
 * The grammar activity's own settings, mirroring VocabQuizSettings' place in
 * the layout. There are none yet: every option the grammar session currently
 * reads (SRS pacing, appearance, sync) applies to both activities and so lives
 * in global settings. The cog is still shown for symmetry with the vocabulary
 * quiz, and this placeholder is the honest answer rather than an invented
 * grammar-only toggle - drop the message and render controls here the moment
 * one exists.
 */
export function GrammarQuizSettings() {
    return (
        <p className="type-support">
            The grammar quiz has no settings of its own yet. Everything that shapes
            a grammar session right now (review pacing, appearance, cloud sync) is
            shared with the other activities and lives in the global settings.
        </p>
    );
}
