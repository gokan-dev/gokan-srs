/**
 * A clip of a word or sentence read aloud. The file is `audio/{clip}.{extension}` on the
 * site, the extension given by `index/audio.json`. Clips are committed in the dataset (Git
 * LFS), but they are text-to-speech in the one voice `index/audio.json` names, under that
 * voice's terms, not the dataset's licence (docs/ARCHITECTURE.md, Audio). An item carries one
 * only when the dataset commits its clip, and a deploy uploads every such clip before it
 * ships the dataset, so a listed clip always exists.
 */
export interface AudioRef {
    /** The clip's content key: the same input, voice and engine always give the same key. */
    clip: string;
}

/** `compiled/index/audio.json`: the voice every clip is read in, how its files are named and how to credit it. */
export interface AudioIndex {
    engine: 'voicevox';
    engineVersion: string;
    voice: string;
    style: string;
    /** The credit the voice's terms require, shown wherever clips are credited ("VOICEVOX:冥鳴ひまり"). */
    credit: string;
    termsUrl: string;
    /** The clip files' extension, without the dot ("opus"). */
    extension: string;
    contentType: string;
}
