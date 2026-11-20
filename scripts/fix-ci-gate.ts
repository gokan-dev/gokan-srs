/**
 * Whether a failed CI run starts the fix-CI agent: `bun scripts/fix-ci-gate.ts --mode check|claim`
 * (claude-fix-ci.yml). The decision is `decideFixCi` (scripts/lib/fixCiGate.ts); this gathers what it
 * reads with `gh` and writes `decision` and `pr` to $GITHUB_OUTPUT.
 *
 * `check` only decides: the cheap first job, so a green run never takes the branch lock. `claim` runs
 * under the lock and records the decision on the PR: the attempt's marker (what makes it one attempt a
 * commit), or the maintainer's notice when the attempts in a row ran out.
 *
 * Reads the run from the environment: RUN_ID, RUN_CONCLUSION, RUN_EVENT, RUN_HEAD_REPOSITORY,
 * RUN_HEAD_BRANCH, RUN_HEAD_SHA, RUN_URL, DEFAULT_BRANCH, AGENT_HUMAN, and GitHub's GITHUB_REPOSITORY,
 * GITHUB_RUN_ID, GITHUB_SERVER_URL.
 */
import { parseArgs } from 'node:util';
import { env, gh, isRecord, output } from './lib/actions';
import { MAX_FIX_STREAK, decideFixCi } from './lib/fixCiGate';
import { type PrComment, fixCiMarker, fixCiStopMarker, parseCommentLines } from './lib/prComments';

const { values } = parseArgs({ options: { mode: { type: 'string', default: 'check' } } });
if (values.mode !== 'check' && values.mode !== 'claim') throw new Error(`--mode is check or claim, not ${values.mode}`);

const repository = env('GITHUB_REPOSITORY');
const run = {
    id: Number(env('RUN_ID')),
    conclusion: env('RUN_CONCLUSION'),
    event: env('RUN_EVENT'),
    headRepository: env('RUN_HEAD_REPOSITORY'),
    headBranch: env('RUN_HEAD_BRANCH'),
    headSha: env('RUN_HEAD_SHA'),
};
const fixRunId = Number(env('GITHUB_RUN_ID'));

interface OpenPr { number: number; isDraft: boolean; author: string }

function openPr(): OpenPr | null {
    const rows: unknown = JSON.parse(gh(['pr', 'list', '--repo', repository, '--head', run.headBranch, '--state', 'open', '--json', 'number,isDraft,author']));
    if (!Array.isArray(rows)) throw new Error('gh pr list did not return a list');
    const row: unknown = rows[0];
    if (!isRecord(row) || typeof row.number !== 'number') return null;
    const author = isRecord(row.author) && typeof row.author.login === 'string' ? row.author.login : '';
    return { number: row.number, isDraft: row.isDraft === true, author };
}

function branchHead(): string | null {
    try {
        return gh(['api', `repos/${repository}/commits/${run.headBranch}`, '--jq', '.sha']).trim() || null;
    } catch {
        return null;
    }
}

const pr = run.conclusion === 'failure' ? openPr() : null;
const comments: PrComment[] = pr
    ? parseCommentLines(gh(['api', '--paginate', `repos/${repository}/issues/${pr.number}/comments`, '--jq', '.[] | {type: .user.type, body}']))
    : [];
const decision = decideFixCi({
    run,
    repository,
    defaultBranch: env('DEFAULT_BRANCH'),
    branchHead: pr ? branchHead() : null,
    pr,
    comments,
    fixRunId,
});

output('decision', decision.kind);
output('pr', decision.kind === 'skip' ? '' : decision.pr);

const sha = run.headSha.slice(0, 10);
const thisRun = `${env('GITHUB_SERVER_URL')}/${repository}/actions/runs/${fixRunId}`;
switch (decision.kind) {
    case 'skip':
        console.log(decision.reason);
        break;
    case 'fix':
        console.log(`Fixing ${sha} on PR #${decision.pr}${decision.resumed ? ' (a re-run of this attempt)' : ''}.`);
        if (values.mode === 'claim' && !decision.resumed) {
            gh(['pr', 'comment', String(decision.pr), '--repo', repository, '--body',
                `${fixCiMarker(run.headSha, fixRunId)}\nCI failed on \`${sha}\` (${env('RUN_URL')}): the fix-CI agent is on it (${thisRun}).`]);
        }
        break;
    case 'stop': {
        console.log(`${decision.streak} fix attempts in a row on PR #${decision.pr}: asking the maintainer.`);
        if (values.mode === 'claim') {
            const human = process.env.AGENT_HUMAN || pr?.author || '';
            gh(['pr', 'comment', String(decision.pr), '--repo', repository, '--body', [
                fixCiStopMarker(run.headSha),
                `@${human} CI failed on \`${sha}\` (${env('RUN_URL')}) after ${MAX_FIX_STREAK} fix attempts in a row, so no agent starts on it.`,
                'Push a fix, or reply on this PR: a word from you lets the fix-CI agent try again on the next failure.',
            ].join('\n')]);
        }
        break;
    }
}
