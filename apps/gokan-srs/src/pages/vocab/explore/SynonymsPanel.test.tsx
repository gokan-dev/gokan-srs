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
});
