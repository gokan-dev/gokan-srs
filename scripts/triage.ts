/**
 * The deterministic half of claude-triage.yml: `bun scripts/triage.ts round|outcome|finished`. Each
 * command reads files and the environment the workflow prepared and writes its answer to
 * $GITHUB_OUTPUT (and the comments to post to $RUNNER_TEMP); the workflow's own steps call `gh`.
 *
 *   round     Whether this commit is triaged, and as what (scripts/lib/triageRound.ts).
 *             Reads COMMENTS_FILE (the PR's comments, one JSON object a line), SHA, RETRIAGE.
 *   outcome   The outcome from the agent's brief (scripts/lib/triageOutcome.ts). Reads BRIEF_FILE,
 *             ROUND, AUTO_ROUNDS, MAX_AUTO_ROUNDS, REPEAT, SHA, TAG, HUMAN, BASE, PR. Writes body.md,
 *             and final-pass.md when points wait for the release PR's final pass.
 *   finished  The done comment of a finish's push. Reads SHA, TAG, HUMAN, BASE. Writes body.md.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCommentLines } from './lib/prComments';
import { type Repeat, decideRound } from './lib/triageRound';
import { finishedComment, parseBrief, resolveOutcome, trackerNote, triageComment } from './lib/triageOutcome';

function env(name: string): string {
    const value = process.env[name];
    if (value === undefined) throw new Error(`${name} is not set`);
    return value;
}

function output(name: string, value: string | number | boolean): void {
    const file = process.env.GITHUB_OUTPUT;
    if (file) appendFileSync(file, `${name}=${value}\n`);
    console.log(`${name}=${value}`);
}

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
        output('round', gate.round);
        break;
    }
    case 'outcome': {
        const autoRounds = Number(env('AUTO_ROUNDS'));
        const maxAutoRounds = Number(env('MAX_AUTO_ROUNDS'));
        const repeat = readRepeat(process.env.REPEAT ?? '');
        const resolution = resolveOutcome({
            brief: parseBrief(readFileSync(env('BRIEF_FILE'), 'utf8')),
            round: Number(env('ROUND')),
            autoRounds,
            maxAutoRounds,
            repeat,
        });
        const onRelease = env('BASE').startsWith('release/');
        write('body.md', triageComment({ resolution, sha: env('SHA'), tag: process.env.TAG ?? '', human: env('HUMAN'), autoRounds, maxAutoRounds, repeat, onRelease }));
        if (resolution.deferred.length > 0) write('final-pass.md', trackerNote(Number(env('PR')), resolution.deferred));
        output('outcome', resolution.outcome);
        output('deferred', resolution.deferred.length);
        break;
    }
    case 'finished':
        write('body.md', finishedComment({ sha: env('SHA'), tag: process.env.TAG ?? '', human: env('HUMAN'), onRelease: env('BASE').startsWith('release/') }));
        output('outcome', 'done');
        output('deferred', 0);
        break;
    default:
        throw new Error(`Unknown command: ${command ?? '(none)'}. Use round, outcome or finished.`);
}
