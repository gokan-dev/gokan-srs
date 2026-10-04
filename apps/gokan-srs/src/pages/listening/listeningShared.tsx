/** Small pieces shared by the listening library's two pages. */

/**
 * Coverage counts Gokan vocabulary only, which leaves out particles, kana-only
 * words and loanwords. Said on every page that shows a figure, so nobody reads
 * it as "I understand 80% of the episode".
 */
export function VocabularyOnlyNote({ className = '' }: { className?: string }) {
    return (
        <p className={`font-gothic text-xs text-tertiary ${className}`}>
            Figures count kanji vocabulary only. Particles, kana-only words and loanwords are not included yet.
        </p>
    );
}

/** Jiten's derived data is CC BY-SA 4.0, attribution required wherever it is shown. */
export function JitenCredit({ url = 'https://jiten.moe', className = '' }: { url?: string; className?: string }) {
    return (
        <p className={`font-gothic text-xs text-tertiary ${className}`}>
            Episode vocabulary from{' '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Jiten</a>
            , licensed{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">CC BY-SA 4.0</a>.
        </p>
    );
}
