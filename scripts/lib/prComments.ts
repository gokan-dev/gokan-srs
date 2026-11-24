// A PR's conversation as the agent workflows read it: the gokan markers their deterministic steps write
// at the top of a comment, and who spoke. Shared by the fix-CI gate and the triage gate, so both read a
// comment the same way. Pure: the scripts fetch the comments, this sorts them.
import { isRecord } from './actions';

export interface PrComment {
    /** GitHub's `user.type`: `User` for a person (or a member's token), `Bot` for an app or GITHUB_TOKEN. */
    type: string;
    body: string;
}

export type CommentEvent =
    | {
        kind: 'triage';
        sha: string;
        outcome: string;
        /** The points its Apply section marks `(defect)`: what the next round set out to fix. */
        defects: number;
        /** Its "Left for one final pass" section as posted (the points set aside), or ''. */
        finalPass: string;
    }
    | { kind: 'decision' }
    | { kind: 'fix-ci'; sha: string; run: number }
    | { kind: 'fix-ci-stop'; sha: string }
    | { kind: 'human' }
    | { kind: 'other' };

const TRIAGE = /^<!-- gokan-triage sha=(\w+) outcome=(\w+) -->/;
const FIX_CI = /^<!-- gokan-fix-ci sha=(\w+) run=(\d+) -->/;
const FIX_CI_STOP = /^<!-- gokan-fix-ci-stop sha=(\w+) -->/;
export const DECISION_MARKER = '<!-- gokan-decision -->';

export const triageMarker = (sha: string, outcome: string): string => `<!-- gokan-triage sha=${sha} outcome=${outcome} -->`;
export const fixCiMarker = (sha: string, run: number): string => `<!-- gokan-fix-ci sha=${sha} run=${run} -->`;
export const fixCiStopMarker = (sha: string): string => `<!-- gokan-fix-ci-stop sha=${sha} -->`;

const DEFECT_POINT = /^### \d+\..*\(defect\)\s*$/;
/** triageOutcome.ts's FINAL_PASS_HEADING, repeated here: that module imports this one. */
const FINAL_PASS = 'Left for one final pass';

/** The body of a posted brief's `## <heading>` section, up to the next `## `, or ''. */
function sectionOf(body: string, heading: string): string {
    const lines: string[] = [];
    let inside = false;
    for (const line of body.split('\n')) {
        if (line.startsWith('## ')) inside = line.slice(3).trim().startsWith(heading);
        // A decide brief's footer (the Send box and its instructions) follows a rule, not a heading.
        else if (line.trim() === '---') inside = false;
        else if (inside) lines.push(line);
    }
    return lines.join('\n').trim();
}

/** The `(defect)` points under a posted brief's `## Apply` (renderBrief marks every Apply point). */
function applyDefects(body: string): number {
    let inApply = false;
    let count = 0;
    for (const line of body.split('\n')) {
        if (line.startsWith('## ')) inApply = line.trim() === '## Apply';
        else if (inApply && DEFECT_POINT.test(line)) count++;
    }
    return count;
}

/** What one comment is: a step's marker, a person speaking, or neither (a bot's report, another notice). */
export function classifyComment(comment: PrComment): CommentEvent {
    const body = comment.body.trimStart();
    const triage = TRIAGE.exec(body);
    if (triage) return { kind: 'triage', sha: triage[1], outcome: triage[2], defects: applyDefects(body), finalPass: sectionOf(body, FINAL_PASS) };
    if (body.startsWith(DECISION_MARKER)) return { kind: 'decision' };
    const fix = FIX_CI.exec(body);
    if (fix) return { kind: 'fix-ci', sha: fix[1], run: Number(fix[2]) };
    const stop = FIX_CI_STOP.exec(body);
    if (stop) return { kind: 'fix-ci-stop', sha: stop[1] };
    // A member's comment with any other gokan marker (the staging reviewer's status) is not the maintainer speaking.
    if (comment.type === 'User' && !body.includes('<!-- gokan-')) return { kind: 'human' };
    return { kind: 'other' };
}

/**
 * Whether the maintainer has spoken since an automatic step: a person's comment, a relayed decision, or
 * a triage that was not an automatic round (done, decide). These reset every count of automatic work.
 */
export const isReset = (event: CommentEvent): boolean =>
    event.kind === 'human' || event.kind === 'decision' || (event.kind === 'triage' && !isAutomaticRound(event.outcome));

/** The triage outcomes that start a round without the maintainer: a brief handed straight to the feedback agent. */
export const isAutomaticRound = (outcome: string): boolean => outcome === 'apply' || outcome === 'finish';

/** `gh api --paginate .../comments --jq '.[] | {type: .user.type, body}'` output (one JSON object a line), narrowed once. */
export function parseCommentLines(text: string): PrComment[] {
    return text.split('\n').filter(line => line.trim() !== '').map(line => {
        const row: unknown = JSON.parse(line);
        if (!isRecord(row) || typeof row.body !== 'string') throw new Error(`Not a comment: ${line.slice(0, 80)}`);
        return { type: typeof row.type === 'string' ? row.type : '', body: row.body };
    });
}
