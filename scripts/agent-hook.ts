/**
 * Claude Code PostToolUse hook (.claude/settings.json): after an agent edits a file, run the
 * conventions check and ESLint on that file and hand any failure straight back to the agent
 * (exit code 2, details on stderr), so a rule is fixed while the change is fresh instead of
 * at commit time. Silent and exit 0 when the file is clean or not checked.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

interface HookInput {
    tool_input?: { file_path?: unknown };
}

function isHookInput(value: unknown): value is HookInput {
    return typeof value === 'object' && value !== null;
}

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const raw: unknown = JSON.parse(readFileSync(0, 'utf8'));
const filePath = isHookInput(raw) && typeof raw.tool_input?.file_path === 'string' ? raw.tool_input.file_path : null;
if (!filePath || !existsSync(filePath)) process.exit(0);

const file = relative(root, filePath).replaceAll('\\', '/');
// Outside the repo, or inside the dataset submodule (its own repo, its own rules).
if (file.startsWith('..') || file.startsWith('apps/gokan-srs/dataset/')) process.exit(0);

const run = (cmd: string, args: string[]) =>
    spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });

const failures: string[] = [];
const conventions = run('bun', ['scripts/check-conventions.ts', file]);
if (conventions.status !== 0) failures.push(conventions.stderr || conventions.stdout);

if (/\.(ts|tsx|svelte)$/.test(file)) {
    const lint = run('bunx', ['eslint', '--max-warnings', '0', '--no-warn-ignored', file]);
    if (lint.status !== 0) failures.push(lint.stdout || lint.stderr);
}

if (failures.length) {
    console.error(`${file} breaks project rules (AGENTS.md). Fix it now:\n\n${failures.join('\n').trim()}`);
    process.exit(2);
}
