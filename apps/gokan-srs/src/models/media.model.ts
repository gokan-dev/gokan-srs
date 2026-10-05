/**
 * The learner's own mark on one episode, stored in `UserProgress.watchedEpisodes`
 * under `episodeKey(mediaId, number)`.
 */
export interface WatchedEpisode {
    watched: boolean;
    /** Epoch ms of the last change; the newer side wins a Drive merge. */
    updatedAt: number;
    /** Share of the episode's vocabulary occurrences known when it was marked watched, 0..1. */
    coverageAtWatch?: number;
}
