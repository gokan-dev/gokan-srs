// Whether a commit gets triaged, and as what kind of round (claude-triage.yml, "Find the round"). Pure:
// scripts/triage-round.ts reads the PR's comments, this decides from them.
//
// A commit is triaged once. The exceptions are the answers that push nothing, which would otherwise
// leave the PR with no next round and so no done (a sprint member waits forever, PR #230, #263):
//   - a lone apply or finish brief that the feedback agent answered without a push;
//   - a maintainer's decision on a decide brief that pushed nothing (they chose to stop, or nothing
//     was left to change).
// claude-address-feedback.yml asks for those with `retriage`. Every other triage of a triaged commit stops.
import { type CommentEvent, type PrComment, classifyComment, isAutomaticRound, isReset } from './prComments';

export type Repeat = 'apply' | 'finish' | 'decision';

export type RoundGate =
    | { kind: 'skip'; reason: string }
    | {
        kind: 'triage';
        /** Set when this triage is the one repeat allowed after an answer that pushed nothing. */
        repeat: Repeat | null;
        /**
         * The last triage handed its defaults over as the PR's final round (`finish`): this commit is
         * that round's push (or a fix of it). Triage waits for CI on it, then sorts its PR review with
         * the round 2+ bar (resolveOutcome's `finishing`), with no staging round.
         */
        finishing: boolean;
        /** Automatic rounds since the maintainer last spoke. */
        autoRounds: number;
        /**
         * The defects the latest of those automatic rounds set out to fix, or null when none ran since
         * the maintainer last spoke: rounds go on while each brief has fewer (resolveOutcome).
         */
        lastDefects: number | null;
        /**
         * The points earlier triages set aside for the final pass since the last finish, as posted
         * (`### n. ...` blocks): the finish applies them with this round's own polish, so a point set
         * aside in round 2 is not lost when round 4 finishes.
         */
        carried: string;
        /** This round's number on the PR, from 1. */
        round: number;
    };

type TriageEvent = Extract<CommentEvent, { kind: 'triage' }>;
const isTriage = (event: CommentEvent): event is TriageEvent => event.kind === 'triage';

export function decideRound(comments: PrComment[], sha: string, retriage: boolean): RoundGate {
    const events = comments.map(classifyComment);
    const triages = events.filter(isTriage);
    const lastReset = events.findLastIndex(isReset);
    const automatic = events.slice(lastReset + 1).filter(isTriage).filter(event => isAutomaticRound(event.outcome));
    const autoRounds = automatic.length;
    // A finish hands over no defect, so only an apply sets the count the next brief must beat; and a
    // round-1 apply of polish alone (round 1 applies polish) sets none, or round 2's first real
    // defect would read as "no fewer than 0" and stop the rounds.
    const lastApply = automatic.filter(event => event.outcome === 'apply').at(-1)?.defects;
    const lastDefects = lastApply ? lastApply : null;
    const round = triages.length + 1;

    const forSha = triages.filter(event => event.sha === sha);
    let repeat: Repeat | null = null;
    if (forSha.length > 0) {
        if (!retriage) return { kind: 'skip', reason: `${sha.slice(0, 10)} was already triaged.` };
        const last = forSha[forSha.length - 1];
        const afterLast = events.slice(events.lastIndexOf(last) + 1);
        if (forSha.length === 1 && (last.outcome === 'apply' || last.outcome === 'finish')) repeat = last.outcome;
        else if (last.outcome === 'decide' && afterLast.some(event => event.kind === 'decision')) repeat = 'decision';
        else return { kind: 'skip', reason: `${sha.slice(0, 10)} was already triaged.` };
    }

    // The latest triage on the PR was a finish for an earlier commit, and nobody has spoken since.
    const latest = triages.at(-1);
    const finishing = repeat === null && latest !== undefined && latest.outcome === 'finish' && latest.sha !== sha
        && !events.slice(events.lastIndexOf(latest) + 1).some(isReset);
    const lastFinish = triages.findLastIndex(event => event.outcome === 'finish');
    const carried = triages.slice(lastFinish + 1).map(event => event.finalPass).filter(text => text !== '').join('\n\n');
    return { kind: 'triage', repeat, finishing, autoRounds, lastDefects, carried, round };
}
