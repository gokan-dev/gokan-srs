import { describe, it, expect } from 'vitest';
import { describeOrder, membersToStart, orderToJson, parseReleaseOrder, serialOrder } from './releaseOrder';

const MEMBERS = [170, 172, 173, 175];

describe('parseReleaseOrder', () => {
    it('reads an order naming every member, in task-list order whatever the key order', () => {
        const parsed = parseReleaseOrder({ '175': [173], '#172': [170], '170': [], '173': [] }, MEMBERS);
        expect(parsed).toEqual({
            ok: true,
            order: [
                { member: 170, after: [] },
                { member: 172, after: [170] },
                { member: 173, after: [] },
                { member: 175, after: [173] },
            ],
        });
    });

    it('drops a wait named twice', () => {
        const parsed = parseReleaseOrder({ '170': [], '172': [170, 170], '173': [], '175': [] }, MEMBERS);
        expect(parsed.ok && parsed.order[1]).toEqual({ member: 172, after: [170] });
    });

    it('refuses a member left out', () => {
        const parsed = parseReleaseOrder({ '170': [], '172': [], '173': [] }, MEMBERS);
        expect(parsed).toEqual({ ok: false, problems: ['#175 is missing from the order.'] });
    });

    it('refuses an id that is not a member, as a key or as a wait', () => {
        const parsed = parseReleaseOrder({ '170': [], '172': [999], '173': [], '175': [], '180': [] }, MEMBERS);
        expect(parsed.ok).toBe(false);
        expect(!parsed.ok && parsed.problems).toEqual([
            '#172 waits for #999, which is not a member of this release.',
            '"180" is not a member of this release.',
        ]);
    });

    it('refuses a member waiting for itself, and waits that are not member numbers', () => {
        const parsed = parseReleaseOrder({ '170': [170], '172': '170', '173': ['170'], '175': [] }, MEMBERS);
        expect(!parsed.ok && parsed.problems).toEqual([
            '#170 waits for itself.',
            '#172: its waits are not a list of member numbers.',
            '#173: "170" is not a member number.',
        ]);
    });

    it('refuses a cycle, naming it', () => {
        const parsed = parseReleaseOrder({ '170': [175], '172': [170], '173': [], '175': [172] }, MEMBERS);
        expect(parsed).toEqual({ ok: false, problems: ['The waits form a cycle: #170 -> #175 -> #172 -> #170.'] });
    });

    it('refuses what is not an object keyed by member', () => {
        expect(parseReleaseOrder([[170]], MEMBERS).ok).toBe(false);
        expect(parseReleaseOrder(null, MEMBERS).ok).toBe(false);
        expect(parseReleaseOrder(undefined, MEMBERS).ok).toBe(false);
    });

    it('reads back what orderToJson writes', () => {
        const order = serialOrder(MEMBERS);
        expect(parseReleaseOrder(JSON.parse(orderToJson(order)), MEMBERS)).toEqual({ ok: true, order });
    });
});

describe('membersToStart', () => {
    const order = [
        { member: 170, after: [] },
        { member: 172, after: [170] },
        { member: 173, after: [] },
        { member: 175, after: [173] },
    ];

    it('starts every member with nothing to wait for', () => {
        expect(membersToStart(order, new Set(), new Set())).toEqual([170, 173]);
    });

    it('starts a member once what it waits for is merged, and never one already in flight', () => {
        expect(membersToStart(order, new Set([170]), new Set([173]))).toEqual([172]);
        expect(membersToStart(order, new Set([170]), new Set([172, 173]))).toEqual([]);
    });

    it('starts nothing once every member is merged', () => {
        expect(membersToStart(order, new Set(MEMBERS), new Set())).toEqual([]);
    });

    it('in the serial order, starts one member at a time', () => {
        const serial = serialOrder(MEMBERS);
        expect(membersToStart(serial, new Set(), new Set())).toEqual([170]);
        expect(membersToStart(serial, new Set([170]), new Set())).toEqual([172]);
        expect(membersToStart(serial, new Set([170]), new Set([172]))).toEqual([]);
    });
});

describe('describeOrder', () => {
    it('writes one line per member', () => {
        expect(describeOrder([{ member: 170, after: [] }, { member: 172, after: [170, 173] }])).toBe(
            '- #170: starts at once\n- #172: after #170, #173',
        );
    });
});
