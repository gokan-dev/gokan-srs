// What a triage ends in, decided from its brief by the workflow, not by the agent's word for it
// (claude-triage.yml, "Post the outcome"). Pure: scripts/triage-outcome.ts reads the brief and writes
// the comments, the workflow posts them.
//
// The agent sorts each point into a section of the brief and marks every Apply point (defect) or
// (polish). The outcome follows from the sections:
//   - decide: a point is the maintainer's call.
//   - apply:  a defect to fix: a new round (rc, staging review, triage).
//   - finish: no defect is left, only polish (from round 2) or reversible defaults. They are applied
//             once, as the PR's last round, with no staging round after it: the triage of that push
//             (`finishing`) waits for CI, then sorts its PR review with the round 2+ bar, so it ends in
//             done, apply or decide: the finish's own push is never finished again.
//   - done:   nothing to change.
// From round 2 on, polish starts no round of its own: it waits beside the defects, and is applied by
// the finish once they are gone. Only what is left after a finish (or after an answer that pushed
// nothing) is left on the PR, and the release tracker, for the maintainer.
//
// Automatic rounds go on while they converge: an apply asks the maintainer first when its brief has
// no fewer defects than the last automatic round set out to fix (`stalled`), when the same commit was
// already answered without a push (`repeat`), or past maxAutoRounds in a row (`rounds`). 1.69.0 waited
// about 45h on seven "keep going?" briefs under a fixed cap of 2, every one answered "yes".
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
// A marker elsewhere in the heading sets no kind (the point stays a defect, the safe default), but is
// still dropped from the title: renderPoints writes the kind back, and two would read as a contradiction.
const ANY_KIND = /\s*\((?:polish|defect)\)/gi;

function parsePoints(section: string, text: string): BriefPoint[] {
    const points: BriefPoint[] = [];
    const preamble: string[] = [];
    for (const line of text.split('\n')) {
        const point = POINT.exec(line);
        if (point) {
            const kind = KIND.exec(point[2]);
            points.push({
                number: Number(point[1]),
                title: point[2].replace(ANY_KIND, '').trim(),
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
        // The agent reads earlier triages as posted, which end in this section (renderBrief), and may
        // write one back. Its points are polish by definition, so they are Apply points marked polish.
        if (heading.startsWith(FINAL_PASS_HEADING)) {
            brief.apply.push(...parsePoints(heading, body).map(point => ({ ...point, polish: true })));
            continue;
        }
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
    /** This commit is the push of a finish brief: its review is sorted with the round 2+ bar. */
    finishing: boolean;
    /** The defects the last automatic round set out to fix, null when none ran since the maintainer spoke. */
    lastDefects: number | null;
    /** Polish earlier triages set aside since the last finish (triageRound's `carried`, parsed): the finish applies it too. */
    carried?: BriefPoint[];
}

/** `carried` (posted `### n. ...` blocks) as polish points; parseBrief reads the section as polish. */
export function parseCarried(text: string): BriefPoint[] {
    return text.trim() === '' ? [] : parseBrief(`## ${FINAL_PASS_HEADING}\n${text}\n`).apply;
}

/** The carried points this brief does not list again (by title), numbered after its own. */
function withCarried(brief: Brief, polish: BriefPoint[], carried: readonly BriefPoint[]): BriefPoint[] {
    const listed = new Set([...brief.apply, ...brief.defaults].map(point => point.title.toLowerCase()));
    const fresh = carried.filter((point, i) => !listed.has(point.title.toLowerCase()) && carried.findIndex(p => p.title.toLowerCase() === point.title.toLowerCase()) === i);
    const next = Math.max(0, ...[...brief.apply, ...brief.defaults, ...brief.yourCall].map(point => point.number)) + 1;
    return [...polish, ...fresh.map((point, i) => ({ ...point, polish: true, number: next + i }))];
}

export type Escalation = 'rounds' | 'repeat' | 'stalled';

export interface Resolution {
    outcome: Outcome;
    /** Why a would-be apply asks the maintainer instead. */
    escalation: Escalation | null;
    /** The brief handed on: without the points left for the final pass. */
    brief: Brief;
    /** Left for one final pass (the release PR's, or the maintainer's at merge). */
    deferred: BriefPoint[];
}

export function resolveOutcome({ brief, round, autoRounds, maxAutoRounds, repeat, finishing, lastDefects, carried = [] }: OutcomeInput): Resolution {
    const late = round >= 2 || finishing;
    const defects = late ? brief.apply.filter(point => !point.polish) : brief.apply;
    const polish = late ? brief.apply.filter(point => point.polish) : [];
    const handed = (apply: BriefPoint[], defaults: BriefPoint[]): Brief => ({ ...brief, apply, defaults });

    if (brief.yourCall.length > 0) {
        return { outcome: 'decide', escalation: null, brief: handed(defects, brief.defaults), deferred: polish };
    }
    if (defects.length > 0) {
        const marked = defects.filter(point => !point.polish).length;
        const escalation: Escalation | null = repeat !== null ? 'repeat'
            : autoRounds >= maxAutoRounds ? 'rounds'
                : lastDefects !== null && marked >= lastDefects ? 'stalled'
                    : null;
        return { outcome: escalation ? 'decide' : 'apply', escalation, brief: handed(defects, brief.defaults), deferred: polish };
    }
    // No defect is left: the polish and defaults are applied once, as the last round. A finish's push
    // is never finished again, and an answer that already pushed nothing is not asked twice: what they
    // leave waits for the maintainer.
    const remaining = withCarried(brief, polish, carried);
    if (remaining.length + brief.defaults.length > 0 && !finishing && repeat === null) {
        return { outcome: 'finish', escalation: null, brief: handed(remaining, brief.defaults), deferred: [] };
    }
    return { outcome: 'done', escalation: null, brief: handed([], []), deferred: [...remaining, ...brief.defaults] };
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
    /** The defects the last automatic round set out to fix (OutcomeInput's), for a `stalled` brief's line. */
    lastDefects: number | null;
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
                `Automatic round ${autoRounds + 1} (at most ${maxAutoRounds}): the rounds go on while each has fewer defects than the last, then a maintainer is asked first.`,
                '',
                brief,
            );
            break;
        case 'finish':
            lines.push(
                `@claude please apply this triage of the reviews of ${subject} to this branch: no defect is left, only polish and reversible defaults, so this is the last round.`,
                'Once CI passes on the push, triage of its PR review ends the PR without another staging round.',
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
    const defects = resolution.brief.apply.filter(point => !point.polish).length;
    const why = ((): string => {
        switch (resolution.escalation) {
            case 'rounds':
                return `${autoRounds} automatic rounds have run since you last weighed in, and the reviews of ${subject} still raise the points below.`;
            case 'stalled':
                return `The reviews of ${subject} raise ${defects} ${defects === 1 ? 'defect' : 'defects'}, no fewer than the ${input.lastDefects ?? 0} the last round set out to fix, so the rounds are not converging.`;
            case 'repeat':
                return repeat === 'decision'
                    ? `Your answer on ${subject} pushed nothing, and a triage of it still raises the points below.`
                    : `The fixes for ${subject} pushed nothing, and a second triage of it still raises the points below.`;
        }
    })();
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

/** The release tracker's record of what one member left for the release PR's final pass. */
export function trackerNote(pr: number, deferred: BriefPoint[]): string {
    const points = deferred.map(point => `### ${point.number}. ${point.title}\n${point.text}`.trimEnd());
    return `<!-- gokan-final-pass pr=${pr} -->\n#${pr} left these points for the release PR's final pass:\n\n${points.join('\n\n')}\n`;
}
