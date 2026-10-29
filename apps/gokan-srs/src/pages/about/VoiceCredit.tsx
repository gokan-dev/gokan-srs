import type { AudioIndex } from '@gokan/dataset-schema';

/**
 * The voice's credit as the dataset words it (its terms ask for that exact form), set as
 * Japanese and never broken: split between two kana, the name reads like a typo.
 */
export function VoiceCredit({ audio }: { audio: AudioIndex }) {
    return (
        <p className="type-body mt-3">
            Recordings of words and sentences are text-to-speech, voiced by{" "}
            <a
                href={audio.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                lang="ja"
                className="font-gothic whitespace-nowrap text-accent underline"
            >
                {audio.credit}
            </a>
            . They are used under that voice's terms, not the license of the words and sentences.
        </p>
    );
}
