// What a triage ends in, decided from its brief by the workflow, not by the agent's word for it
// (claude-triage.yml, "Post the outcome"). Pure: scripts/triage-outcome.ts reads the brief and writes
// the comments, the workflow posts them.
//
// The agent sorts each point into a section of the brief and marks every Apply point (defect) or
// (polish). The outcome follows from the sections:
//   - decide: a point is the maintainer's call.
//   - apply:  a defect to fix: a new round (rc, staging review, triage).
//   - finish: in round 1, only reversible defaults are left. They are applied, and the PR is done once
//             CI and the PR review pass on that push, with no staging round after it.
//   - done:   nothing to change.
// From round 2 on, polish starts no round: polish points, and defaults with no defect beside them, are
// left on the PR (and the release tracker) for one final pass, and a round of only those is done.
import { triageMarker } from './prComments';
import type { Repeat } from './triageRound';

export type Outcome = 'done' | 'apply' | 'finish' | 'decide';

export interface BriefPoint {
    number: number;
    title: string;
    /** An Apply point the agent marked (polish): an improvement, not a defect. */
    polish: boolean;
    text: string;
}

export interface Brief {
    /** Anything before the first section: a done brief's one line. */
    summary: string;
    apply: BriefPoint[];
    defaults: BriefPoint[];
    yourCall: BriefPoint[];
    /** Kept as written: one line a point. */
    notInChange: string;
}

const SECTIONS = {
    apply: 'Apply',
    defaults: 'Decided by default',
    yourCall: 'Your call',
    notInChange: 'Not in this change',
} as const;
type SectionKey = keyof typeof SECTIONS;
const SECTION_KEYS: SectionKey[] = ['apply', 'defaults', 'yourCall', 'notInChange'];

const POINT = /^### (\d+)\.\s+(.*)$/;
const KIND = /\s*\((polish|defect)\)\s*$/i;

function parsePoints(section: string, text: string): BriefPoint[] {
    const points: BriefPoint[] = [];
    const preamble: string[] = [];
    for (const line of text.split('\n')) {
        const point = POINT.exec(line);
        if (point) {
            const kind = KIND.exec(point[2]);
            points.push({
                number: Number(point[1]),
                title: point[2].replace(KIND, '').trim(),
                polish: kind?.[1].toLowerCase() === 'polish',
                text: '',
            });
        } else if (points.length > 0) {
            const last = points[points.length - 1];
            last.text += `${line}\n`;
        } else if (line.trim() !== '') {
            preamble.push(line);
        }
    }
    if (points.length === 0 && preamble.length > 0) {
        throw new Error(`The brief's "${section}" section has text but no "### n. ..." point.`);
    }
    return points.map(point => ({ ...point, text: point.text.trim() }));
}

/** The triage agent's brief, with any "@claude" defused: only the workflow's own line may start the feedback agent. */
export function parseBrief(markdown: string): Brief {
    const text = markdown.replace(/@claude/gi, 'Claude').replace(/\r\n/g, '\n');
    const parts = text.split(/^## /m);
    const brief: Brief = { summary: parts[0].trim(), apply: [], defaults: [], yourCall: [], notInChange: '' };
    for (const part of parts.slice(1)) {
        const newline = part.indexOf('\n');
        const heading = (newline === -1 ? part : part.slice(0, newline)).trim();
        const body = newline === -1 ? '' : part.slice(newline + 1);
        const key = SECTION_KEYS.find(candidate => heading.startsWith(SECTIONS[candidate]));
        if (!key) throw new Error(`The brief has an unknown section: "## ${heading}".`);
        if (key === 'notInChange') brief.notInChange = body.trim();
        else brief[key] = parsePoints(heading, body);
    }
    return brief;
}

export interface OutcomeInput {
    brief: Brief;
    round: number;
    autoRounds: number;
    maxAutoRounds: number;
    repeat: Repeat | null;
}

export interface Resolution {
    outcome: Outcome;
    /** Why a would-be apply asks the maintainer instead. */
    escalation: 'rounds' | 'repeat' | null;
    /** The brief handed on: without the points left for the final pass. */
    brief: Brief;
    /** Left for one final pass (the release PR's, or the maintainer's at merge). */
    deferred: BriefPoint[];
}

export function resolveOutcome({ brief, round, autoRounds, maxAutoRounds, repeat }: OutcomeInput): Resolution {
    const late = round >= 2;
    const defects = late ? brief.apply.filter(point => !point.polish) : brief.apply;
    const polish = late ? brief.apply.filter(point => point.polish) : [];
    const handed = (apply: BriefPoint[], defaults: BriefPoint[]): Brief => ({ ...brief, apply, defaults });

    if (brief.yourCall.length > 0) {
        return { outcome: 'decide', escalation: null, brief: handed(defects, brief.defaults), deferred: polish };
    }
    if (defects.length > 0) {
        const escalation = repeat !== null ? 'repeat' : autoRounds >= maxAutoRounds ? 'rounds' : null;
        return { outcome: escalation ? 'decide' : 'apply', escalation, brief: handed(defects, brief.defaults), deferred: polish };
    }
    // Only defaults are left. In round 1 they are applied as the last round; later, or when an answer
    // already pushed nothing, they wait for the final pass with the polish.
    if (brief.defaults.length > 0 && !late && repeat === null) {
        return { outcome: 'finish', escalation: null, brief: handed([], brief.defaults), deferred: [] };
    }
    return { outcome: 'done', escalation: null, brief: handed([], []), deferred: [...polish, ...brief.defaults] };
}

function renderPoints(heading: string, points: BriefPoint[], withKind = false): string[] {
    if (points.length === 0) return [];
    const kind = (point: BriefPoint): string => (withKind ? (point.polish ? ' (polish)' : ' (defect)') : '');
    return [`## ${heading}`, ...points.map(point => `### ${point.number}. ${point.title}${kind(point)}\n${point.text}`.trimEnd())];
}

export const FINAL_PASS_HEADING = 'Left for one final pass';

/** The brief as posted: the agent's sections, then what waits for the final pass. */
export function renderBrief(brief: Brief, deferred: BriefPoint[]): string {
    return [
        brief.summary,
        ...renderPoints('Apply', brief.apply, true),
        ...renderPoints('Decided by default (reversible)', brief.defaults),
        ...renderPoints('Your call', brief.yourCall),
        ...(brief.notInChange ? ['## Not in this change', brief.notInChange] : []),
        ...renderPoints(FINAL_PASS_HEADING, deferred),
    ].filter(block => block !== '').join('\n\n');
}

export interface CommentInput {
    resolution: Resolution;
    sha: string;
    /** The rc tag on the commit, if the round reached staging. */
    tag: string;
    human: string;
    autoRounds: number;
    maxAutoRounds: number;
    repeat: Repeat | null;
    /** A sprint member (its base is `release/*`): done merges it, and nobody is mentioned for it. */
    onRelease: boolean;
}

const subjectOf = (sha: string, tag: string): string =>
    tag ? `\`${tag}\` ([staging](https://staging.gokan-srs.com))` : `\`${sha.slice(0, 10)}\``;

function doneLine(human: string, onRelease: boolean, what: string): string {
    return onRelease ? `**Done.** ${what} This member is merged into the release next.` : `@${human} **Ready to merge.** ${what}`;
}

/** The triage comment: its marker, then what happens next, then the brief. */
export function triageComment(input: CommentInput): string {
    const { resolution, sha, tag, human, autoRounds, maxAutoRounds, repeat, onRelease } = input;
    const subject = subjectOf(sha, tag);
    const brief = renderBrief(resolution.brief, resolution.deferred);
    const lines = [triageMarker(sha, resolution.outcome)];
    switch (resolution.outcome) {
        case 'done':
            lines.push(doneLine(human, onRelease, `The reviews of ${subject} leave nothing to change.`), '', brief);
            break;
        case 'apply':
            lines.push(
                `@claude please apply this triage of the reviews of ${subject} to this branch.`,
                `Automatic round ${autoRounds + 1} of ${maxAutoRounds}; after that, a maintainer is asked first.`,
                '',
                brief,
            );
            break;
        case 'finish':
            lines.push(
                `@claude please apply this triage of the reviews of ${subject} to this branch: only reversible defaults are left, so this is the last round.`,
                'Once CI and the PR review pass on the push, the PR is done without another staging round.',
                '',
                brief,
            );
            break;
        case 'decide':
            lines.push(...decideLines(input, subject, brief, repeat, autoRounds));
            break;
    }
    return `${lines.join('\n')}\n`;
}

function decideLines(input: CommentInput, subject: string, brief: string, repeat: Repeat | null, autoRounds: number): string[] {
    const { human, resolution } = input;
    if (resolution.escalation === null) {
        return [
            `@${human} **Your call** on the reviews of ${subject}. Nothing runs until you answer.`,
            '',
            brief,
            ...sendFooter(false),
        ];
    }
    const why = resolution.escalation === 'rounds'
        ? `${autoRounds} automatic rounds have run since you last weighed in, and the reviews of ${subject} still raise the points below.`
        : repeat === 'decision'
            ? `Your answer on ${subject} pushed nothing, and a triage of it still raises the points below.`
            : `The fixes for ${subject} pushed nothing, and a second triage of it still raises the points below.`;
    return [
        `@${human} **Your call: keep going?** ${why} Nothing runs until you answer.`,
        '',
        brief,
        '',
        '## Keep going?',
        '- [ ] **A**: Apply the points above (one more round).',
        '- [ ] **B**: Stop here: the PR is done as it is.',
        ...sendFooter(true),
    ];
}

function sendFooter(escalated: boolean): string[] {
    return [
        '',
        '---',
        'Tick one option per question, then tick **Send** below, or reply on this PR: a reply sends too, with any note in it (for example `2B, keep the label short`).',
        ...(escalated ? [] : ['The points under Apply go ahead with your answer.']),
        '',
        '- [ ] **Send my choices to the agent**',
    ];
}

/** The done comment of a finish's push: CI and the PR review passed, so the defaults round ends the PR. */
export function finishedComment({ sha, tag, human, onRelease }: { sha: string; tag: string; human: string; onRelease: boolean }): string {
    const what = `The last triage's defaults are applied, and CI and the PR review passed on ${subjectOf(sha, tag)}.`;
    return `${triageMarker(sha, 'done')}\n${doneLine(human, onRelease, what)}\n`;
}

/** The release tracker's record of what one member left for the release PR's final pass. */
export function trackerNote(pr: number, deferred: BriefPoint[]): string {
    const points = deferred.map(point => `### ${point.number}. ${point.title}\n${point.text}`.trimEnd());
    return `<!-- gokan-final-pass pr=${pr} -->\n#${pr} left these points for the release PR's final pass:\n\n${points.join('\n\n')}\n`;
}
