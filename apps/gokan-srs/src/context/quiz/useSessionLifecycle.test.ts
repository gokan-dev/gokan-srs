import { describe, it, expect } from 'vitest';
import { nextSessionTransition } from './useSessionLifecycle';

const TTL = 30 * 60 * 1000;
const NOW = 1_000_000_000;
const running = {};
const pausedAt = (msAgo: number) => ({ suspendedAt: NOW - msAgo });

describe('nextSessionTransition', () => {
    describe('on the activity page', () => {
        it('starts a session when there is work and none is running', () => {
            expect(nextSessionTransition('activity', true, null, NOW, TTL)).toBe('start');
            expect(nextSessionTransition('activity', false, null, NOW, TTL)).toBeNull();
        });

        it('keeps a running session while there is work, and ends it when the work runs out', () => {
            expect(nextSessionTransition('activity', true, running, NOW, TTL)).toBeNull();
            expect(nextSessionTransition('activity', false, running, NOW, TTL)).toBe('end');
        });

        it('resumes a paused session within the TTL, and ends it past the TTL', () => {
            expect(nextSessionTransition('activity', true, pausedAt(5 * 60 * 1000), NOW, TTL)).toBe('resume');
            expect(nextSessionTransition('activity', true, pausedAt(TTL), NOW, TTL)).toBe('resume');
            expect(nextSessionTransition('activity', true, pausedAt(TTL + 1), NOW, TTL)).toBe('end');
        });

        it('resumes a paused session even when no work is left, so it then ends normally', () => {
            expect(nextSessionTransition('activity', false, pausedAt(1000), NOW, TTL)).toBe('resume');
        });
    });

    describe('on a consult page', () => {
        it('pauses a running session', () => {
            expect(nextSessionTransition('consult', true, running, NOW, TTL)).toBe('suspend');
            expect(nextSessionTransition('consult', false, running, NOW, TTL)).toBe('suspend');
        });

        it('leaves a paused session alone, whatever its age', () => {
            expect(nextSessionTransition('consult', true, pausedAt(1000), NOW, TTL)).toBeNull();
            expect(nextSessionTransition('consult', true, pausedAt(TTL * 4), NOW, TTL)).toBeNull();
        });

        it('never starts a session', () => {
            expect(nextSessionTransition('consult', true, null, NOW, TTL)).toBeNull();
        });
    });

    describe('anywhere else', () => {
        it('ends a running or paused session', () => {
            expect(nextSessionTransition('leave', true, running, NOW, TTL)).toBe('end');
            expect(nextSessionTransition('leave', true, pausedAt(1000), NOW, TTL)).toBe('end');
        });

        it('does nothing without a session', () => {
            expect(nextSessionTransition('leave', true, null, NOW, TTL)).toBeNull();
        });
    });
});
