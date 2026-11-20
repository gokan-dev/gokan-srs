#!/usr/bin/env bun
// A release's build order for claude-start-release.yml (see src/releaseOrder.ts).
//
//   validate --members "170 172 173" [--file .preflight/out/order.json]
//       Prints the order as JSON: the file's when it is valid, else the serial order, with each
//       reason as a GitHub warning on stderr. A missing file is the serial order too.
//   start --members "..." --order '<json>' --merged "..." --in-flight "..."
//       Prints the members to start now, space-separated (nothing when none). An order no longer
//       valid for the members (the task list changed) falls back to the serial order.
//   describe --members "..." --order '<json>'
//       Prints the order as Markdown lines for the tracker.

import fs from 'node:fs';
import { parseArgs } from 'node:util';

import { describeOrder, membersToStart, orderToJson, parseReleaseOrder, serialOrder, type ReleaseOrder } from '../src/releaseOrder';

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
        members: { type: 'string', default: '' },
        file: { type: 'string' },
        order: { type: 'string' },
        merged: { type: 'string', default: '' },
        'in-flight': { type: 'string', default: '' },
    },
});

const ids = (list: string): number[] => list.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isInteger);
const members = ids(values.members);
if (!members.length) {
    console.error('::error::release-order: --members lists no member.');
    process.exit(1);
}

function readJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

/** The order read from `text`, or the serial order with why when it is missing or invalid. */
function orderFrom(text: string | undefined, source: string): ReleaseOrder {
    if (text === undefined || text.trim() === '') {
        console.error(`::warning::No release order (${source}): building the members one at a time.`);
        return serialOrder(members);
    }
    const parsed = parseReleaseOrder(readJson(text), members);
    if (parsed.ok) return parsed.order;
    for (const problem of parsed.problems) console.error(`::warning::Release order (${source}): ${problem}`);
    console.error('::warning::Building the members one at a time instead.');
    return serialOrder(members);
}

const [command] = positionals;
switch (command) {
    case 'validate': {
        const file = values.file;
        const text = file !== undefined && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
        console.log(orderToJson(orderFrom(text, file ?? 'no file')));
        break;
    }
    case 'start': {
        const order = orderFrom(values.order, 'the tracker');
        console.log(membersToStart(order, new Set(ids(values.merged)), new Set(ids(values['in-flight']))).join(' '));
        break;
    }
    case 'describe':
        console.log(describeOrder(orderFrom(values.order, 'the tracker')));
        break;
    default:
        console.error(`::error::release-order: unknown command "${command ?? ''}" (validate, start or describe).`);
        process.exit(1);
}
