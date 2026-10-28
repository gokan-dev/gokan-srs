import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DetailLevels, type DetailLevel } from './DetailBody';

/** The keys React reconciles the levels by: a level whose key holds keeps its state. */
function levelKeys(levels: DetailLevel[]): (string | null)[] {
    const root = DetailLevels({ levels });
    if (!isValidElement<{ children: ReactNode }>(root)) throw new Error('DetailLevels rendered no element');
    const children = root.props.children;
    if (!Array.isArray(children)) throw new Error('DetailLevels rendered no list of levels');
    return children.map((child: ReactElement) => child.key);
}

describe('DetailLevels', () => {
    // Learning a word inserts Your study above Explore: Explore must not remount and lose its search.
    it('keeps a level\'s key when a level appears above it', () => {
        const explore = { key: 'explore', node: <input /> };
        const before = levelKeys([{ key: 'essentials', node: <p /> }, { key: 'your-study', node: null }, explore]);
        const after = levelKeys([{ key: 'essentials', node: <p /> }, { key: 'your-study', node: <p /> }, explore]);
        expect(before.at(-1)).toBe(after.at(-1));
    });

    it('leaves out a level with nothing in it', () => {
        expect(levelKeys([{ key: 'a', node: <p /> }, { key: 'b', node: null }, { key: 'c', node: false }])).toEqual(['a']);
    });
});
