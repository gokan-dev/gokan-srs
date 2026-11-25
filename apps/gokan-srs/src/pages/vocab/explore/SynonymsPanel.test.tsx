// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vocabulary } from '../../../test/fixtures';
import { listedSynonymsOf } from '../../../services/exercise/wordRelation';
import type { SynonymSection } from '../../../utils/synonymSections.utils';
import { SynonymsPanel } from './SynonymsPanel';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress: null, settings: null, session: null, grammarSession: null }, actions: {} }),
}));
vi.mock('../../../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));

/** One meaning listing `count` synonyms of 日本, each sharing "Japan". */
function section(count: number): SynonymSection {
    const words = listedSynonymsOf({ synonyms: Array.from({ length: count }, (_, i) => ({ id: `s${i}`, relation: 'interchangeable' as const, shared: ['japan'], w: [`語${i}`], r: [`ご${i}`], f: 100 + i })) });
    return { sense: 0, glosses: ['Japan'], words };
}

/** Four synonyms of 取る, the first with a nuance line that names 帽子を取る, which no other row holds. */
function withNuance(): SynonymSection {
    const words = listedSynonymsOf({ synonyms: [
        { id: 'n0', relation: 'interchangeable' as const, shared: ['take'], w: ['脱ぐ'], r: ['ぬぐ'], f: 100, nuance: '脱ぐ is to take off clothes; 取る takes off a hat, 帽子を取る.' },
        ...Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, relation: 'interchangeable' as const, shared: ['take'], w: [`語${i}`], r: [`ご${i}`], f: 200 + i })),
    ] });
    return { sense: 0, glosses: ['take'], words };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const renderPanel = (sections: SynonymSection[]) => act(() => root.render(
    <MemoryRouter><SynonymsPanel vocab={vocabulary()} sections={sections} mixedUp={new Map()} /></MemoryRouter>,
));

const search = (text: string) => act(() => {
    const field = container.querySelector('input');
    if (!field) throw new Error('No search field');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
});
const rows = () => [...container.querySelectorAll('a[href^="/vocab/"]')].map(a => a.textContent);

describe('SynonymsPanel', () => {
    it('has no search field over a word whose synonyms fit on one page, as every panel and the dictionary', () => {
        renderPanel([section(2)]);
        expect(container.querySelectorAll('a[href^="/vocab/"]').length).toBe(2);
        expect(container.querySelector('input')).toBeNull();
    });

    it('has one once a meaning lists more rows than it shows', () => {
        renderPanel([section(4)]);
        expect(container.querySelector('input')).not.toBeNull();
    });

    it('finds a row by a Japanese query that only its nuance line holds', () => {
        renderPanel([withNuance()]);
        search('帽子');
        expect(rows()).toHaveLength(1);
        expect(rows()[0]).toContain('脱ぐ');
    });

    it('keeps a marked nuance line\'s Japanese in its face, on one line', () => {
        renderPanel([withNuance()]);
        search('hat');
        expect(container.querySelector('mark')?.textContent).toBe('hat');
        const runs = [...container.querySelectorAll('span[lang="ja"].font-gothic.whitespace-nowrap')].map(span => span.textContent);
        expect(runs).toContain('帽子を取る');
        expect(runs).toContain('脱ぐ');
    });
});
