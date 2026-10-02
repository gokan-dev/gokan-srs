import type { VocabProgress, Vocabulary } from "../models/vocabulary.model";

import { MasteryRing } from "./MasteryRing";
import { isProductionActivated } from "../services/scheduling";
import { Card } from "./ui/Card";
import { CardContent } from "./ui/CardContent";

export function VocabCard({
  vocab,
  progress,
  onClick,
}: {
  vocab: Vocabulary;
  progress: VocabProgress;
  onClick?: () => void;
}) {
  function formatNextReview(date: Date | null): string {
    if (!date) return '-';

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs <= 0) return 'Now';

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `in ${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `in ${hours} h`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `in ${days} d`;

    return date.toLocaleDateString();
  }

  return (
    <div
      onClick={onClick}
      className={`h-full transition-transform hover:scale-[1.02] active:scale-[0.98] ${onClick ? 'cursor-pointer' : ''}`}
    >
      <Card className="h-full flex flex-col justify-between">
        <CardContent className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-lg text-primary font-serif">
                {vocab.writtenForm.kanji}
              </div>

              <div className="text-sm text-secondary">
                {[vocab.reading.primary, ...vocab.reading.alternatives].join(" ・ ")}
              </div>
            </div>

            <div className="flex gap-1">
              <div className="flex flex-col items-center" title="Reading Mastery">
                <MasteryRing memoryStrength={progress.reading.memoryStrength} size={20} variant="reading" />
              </div>
              <div className="flex flex-col items-center" title="Meaning Mastery">
                <MasteryRing memoryStrength={progress.meaning.memoryStrength} size={20} variant="meaning" />
              </div>
              {isProductionActivated(progress.production) && (
                <div className="flex flex-col items-center" title="Production Mastery">
                  <MasteryRing memoryStrength={progress.production!.memoryStrength} size={20} variant="production" />
                </div>
              )}
            </div>
          </div>

          <div className="text-sm text-secondary">
            {vocab.senses[0]?.glosses.map(g => g).slice(0, 3).join(", ")}
          </div>

          <div className="flex justify-between text-xs text-muted">
            <span>
              {progress.stage === "graduated"
                ? "Mastered"
                : `Reviews: ${progress.totalReviews}`}
            </span>
            <span>{formatNextReview(progress.nextReviewAt)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
