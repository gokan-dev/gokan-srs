/**
 * Summarises where an agent run's tokens went, for the job summary of every agent workflow
 * (`bun scripts/agent-usage.ts >> "$GITHUB_STEP_SUMMARY"`). It reads the execution file
 * claude-code-action writes ($RUNNER_TEMP/claude-execution-output.json: every SDK message of the
 * run, written even when the run fails) and prints the token split plus the tool results that
 * filled the context most: a file read whole on every run shows up at the top.
 *
 * Numbers and file paths only. The action's `show_full_output` would print the whole session,
 * and this repo's logs are public.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
// Chars per token for English text and code: an estimate, labelled as one in the output.
const CHARS_PER_TOKEN = 4;

const file = process.argv[2] ?? join(process.env.RUNNER_TEMP ?? '.', 'claude-execution-output.json');
if (!existsSync(file)) {
    console.log('No agent execution file: the agent did not run.');
    process.exit(0);
}
const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
const messages = Array.isArray(parsed) ? parsed.filter(isRecord) : [];

/** The text a tool result put into the context, whichever shape its content has. */
function resultChars(content: unknown): number {
    if (typeof content === 'string') return content.length;
    if (!Array.isArray(content)) return 0;
    return content.filter(isRecord).reduce((sum, part) => sum + str(part.text).length, 0);
}

/** What a tool call targeted: the file for file tools, the command's first words for Bash. */
function target(name: string, input: Json): string {
    const path = str(input.file_path) || str(input.path) || str(input.notebook_path);
    if (path) return path.replace(/^.*?\/gokan-srs\/gokan-srs\//, '');
    if (name === 'Bash') return str(input.command).split(/\s+/).slice(0, 3).join(' ');
    return str(input.pattern);
}

const calls = new Map<string, { name: string; target: string }>();
const totals = new Map<string, { name: string; target: string; calls: number; chars: number }>();
let turnUsage = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
let result: Json | undefined;

for (const message of messages) {
    const body = isRecord(message.message) ? message.message : {};
    const content = Array.isArray(body.content) ? body.content.filter(isRecord) : [];
    if (message.type === 'assistant') {
        const usage = isRecord(body.usage) ? body.usage : {};
        turnUsage = {
            input: turnUsage.input + num(usage.input_tokens),
            cacheWrite: turnUsage.cacheWrite + num(usage.cache_creation_input_tokens),
            cacheRead: turnUsage.cacheRead + num(usage.cache_read_input_tokens),
            output: turnUsage.output + num(usage.output_tokens),
        };
        for (const part of content) {
            if (part.type === 'tool_use') {
                const name = str(part.name);
                calls.set(str(part.id), { name, target: target(name, isRecord(part.input) ? part.input : {}) });
            }
        }
    } else if (message.type === 'user') {
        for (const part of content) {
            if (part.type !== 'tool_result') continue;
            const call = calls.get(str(part.tool_use_id)) ?? { name: '?', target: '' };
            const key = `${call.name}\u0000${call.target}`;
            const row = totals.get(key) ?? { ...call, calls: 0, chars: 0 };
            totals.set(key, { ...row, calls: row.calls + 1, chars: row.chars + resultChars(part.content) });
        }
    } else if (message.type === 'result') {
        result = message;
    }
}

// The result message holds the run's own totals; a run cut off before it falls back to the sum of
// the per-turn usage.
const usage = result && isRecord(result.usage) ? result.usage : undefined;
const split = usage
    ? {
        input: num(usage.input_tokens),
        cacheWrite: num(usage.cache_creation_input_tokens),
        cacheRead: num(usage.cache_read_input_tokens),
        output: num(usage.output_tokens),
    }
    : turnUsage;

const lines = [
    '### Agent token usage',
    '',
    result
        ? `${num(result.num_turns)} turns, API-equivalent cost $${num(result.total_cost_usd).toFixed(2)}.`
        : 'The run ended before its result: the totals below add up the turns it finished.',
    '',
    '| Tokens | Count |',
    '|---|---:|',
    `| Input, uncached | ${fmt(split.input)} |`,
    `| Cache write | ${fmt(split.cacheWrite)} |`,
    `| Cache read | ${fmt(split.cacheRead)} |`,
    `| Output | ${fmt(split.output)} |`,
];

const models = result && isRecord(result.modelUsage) ? Object.entries(result.modelUsage) : [];
const priced = models.filter(([, m]) => isRecord(m) && num(m.costUSD) > 0);
if (priced.length > 1) {
    lines.push('', '| Model | Cost |', '|---|---:|');
    for (const [model, m] of priced) lines.push(`| ${model} | $${num(isRecord(m) ? m.costUSD : 0).toFixed(2)} |`);
}

const top = [...totals.values()].sort((a, b) => b.chars - a.chars).slice(0, 12);
if (top.length) {
    lines.push(
        '',
        'Largest tool results (each stays in the context, re-read from cache on every later turn):',
        '',
        '| Tool | Target | Calls | ~Tokens |',
        '|---|---|---:|---:|',
    );
    for (const row of top) {
        lines.push(`| ${row.name} | \`${row.target.replaceAll('|', '\\|').replaceAll('`', "'")}\` | ${row.calls} | ${fmt(row.chars / CHARS_PER_TOKEN)} |`);
    }
}

console.log(lines.join('\n'));
