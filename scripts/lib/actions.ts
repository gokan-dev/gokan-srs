// The small helpers every pipeline script under scripts/ needs, in one place (AGENTS.md: share, never
// copy; check-conventions.ts refuses a second `isRecord`): narrowing parsed JSON, reading the
// workflow's environment, writing a step output, calling `gh`.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

/** An object (arrays included): what a parsed JSON row is narrowed by before its fields are read. */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** A variable the workflow sets; a missing one is a wiring error, never an empty string. */
export function env(name: string): string {
    const value = process.env[name];
    if (value === undefined) throw new Error(`${name} is not set`);
    return value;
}

/** One step output (to $GITHUB_OUTPUT when it is set), echoed to the log. */
export function output(name: string, value: string | number | boolean): void {
    const file = process.env.GITHUB_OUTPUT;
    if (file) appendFileSync(file, `${name}=${value}\n`);
    console.log(`${name}=${value}`);
}

/** `gh` with its output as text; a non-zero exit throws. */
export const gh = (args: string[]): string => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
