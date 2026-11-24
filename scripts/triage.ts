/**
 * The deterministic half of claude-triage.yml: `bun scripts/triage.ts round|outcome`. Each
 * command reads files and the environment the workflow prepared and writes its answer to
 * $GITHUB_OUTPUT (and the comments to post to $RUNNER_TEMP); the workflow's own steps call `gh`.
 *
 *   round     Whether this commit is triaged, and as what (scripts/lib/triageRound.ts).
 *             Reads COMMENTS_FILE (the PR's comments, one JSON object a line), SHA, RETRIAGE.
 *   outcome   The outcome from the agent's brief (scripts/lib/triageOutcome.ts). Reads BRIEF_FILE,
 *             ROUND, AUTO_ROUNDS, MAX_AUTO_ROUNDS, LAST_DEFECTS, REPEAT, FINISHING, SHA, TAG, HUMAN, BASE, PR. Writes
 *             body.md, and final-pass.md when points wait for the release PR's final pass.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { env, output } from './lib/actions';
import { parseCommentLines } from './lib/prComments';
import { type Repeat, decideRound } from './lib/triageRound';
import { parseBrief, parseCarried, resolveOutcome, trackerNote, triageComment } from './lib/triageOutcome';

const write = (name: string, text: string): void => writeFileSync(join(env('RUNNER_TEMP'), name), text);

function readRepeat(value: string): Repeat | null {
    if (value === 'apply' || value === 'finish' || value === 'decision') return value;
    return null;
}

const command = process.argv[2];
switch (command) {
    case 'round': {
        const gate = decideRound(parseCommentLines(readFileSync(env('COMMENTS_FILE'), 'utf8')), env('SHA'), process.env.RETRIAGE === 'true');
        if (gate.kind === 'skip') {
            console.log(gate.reason);
            output('gate', 'skip');
            break;
        }
        output('gate', 'triage');
        output('repeat', gate.repeat ?? '');
        output('finishing', gate.finishing);
        output('auto_rounds', gate.autoRounds);
        output('last_defects', gate.lastDefects ?? '');
        // Multi-line, so a file the outcome step reads (RUNNER_TEMP lasts the whole job).
        write('carried.md', gate.carried);
        output('round', gate.round);
        break;
    }
    case 'outcome': {
        const autoRounds = Number(env('AUTO_ROUNDS'));
        const maxAutoRounds = Number(env('MAX_AUTO_ROUNDS'));
        const repeat = readRepeat(process.env.REPEAT ?? '');
        const lastDefectsText = process.env.LAST_DEFECTS ?? '';
        const lastDefects = lastDefectsText === '' ? null : Number(lastDefectsText);
        const resolution = resolveOutcome({
            brief: parseBrief(readFileSync(env('BRIEF_FILE'), 'utf8')),
            round: Number(env('ROUND')),
            autoRounds,
            maxAutoRounds,
            repeat,
            finishing: process.env.FINISHING === 'true',
            lastDefects,
            carried: parseCarried(existsSync(join(env('RUNNER_TEMP'), 'carried.md')) ? readFileSync(join(env('RUNNER_TEMP'), 'carried.md'), 'utf8') : ''),
        });
        const onRelease = env('BASE').startsWith('release/');
        write('body.md', triageComment({ resolution, sha: env('SHA'), tag: process.env.TAG ?? '', human: env('HUMAN'), autoRounds, maxAutoRounds, repeat, lastDefects, onRelease }));
        // Only what a PR ends with is left for the maintainer: points deferred beside a defect wait for
        // the PR's own finish round, and a tracker note for them is noise (1.69.0 collected eight).
        if (resolution.outcome === 'done' && resolution.deferred.length > 0) write('final-pass.md', trackerNote(Number(env('PR')), resolution.deferred));
        output('outcome', resolution.outcome);
        output('deferred', resolution.deferred.length);
        break;
    }
    default:
        throw new Error(`Unknown command: ${command ?? '(none)'}. Use round or outcome.`);
}
