export type LearningStatus = 'new' | 'learning' | 'mastered';

export const STATUS_LABEL: Record<LearningStatus, string> = {
    new: 'New',
    learning: 'Learning',
    mastered: 'Mastered',
};
