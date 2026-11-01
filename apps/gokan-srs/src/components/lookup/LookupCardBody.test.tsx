import type { Vocabulary } from '@gokan/dataset-schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { vocabulary } from '../../test/fixtures';
import { LookupCardBody } from './LookupCardBody';

let loaded: Vocabulary = vocabulary();

vi.mock('../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress: null, settings: null, session: null, grammarSession: null }, actions: {} }),
}));
vi.mock('../../hooks/useAsyncData', () => ({
    useAsyncData: () => ({ status: 'ready', data: loaded, error: undefined }),
}));

function render(vocab: Vocabulary): string {
    loaded = vocab;
    return renderToStaticMarkup(
        <MemoryRouter><LookupCardBody target={{ kind: 'word', vocabId: vocab.id }} onNavigate={() => undefined} /></MemoryRouter>,
    );
}

describe('LookupCardBody, the word card', () => {
    it("lists the senses in the page's order, an archaic first sense after the common ones, with plain part-of-speech labels", () => {
        const html = render(vocabulary({
            senses: [
                { pos: ['v5r'], misc: { rawTags: ['arch'], isArchaic: true }, glosses: ['to archaically hold'], related: { compounds: [] } },
                { pos: ['v5r'], misc: { rawTags: [] }, glosses: ['to take'], related: { compounds: [] } },
            ],
        }));
        expect(html).toContain('to take');
        expect(html).not.toContain('to archaically hold');
        expect(html).toContain('Godan verb');
        expect(html).not.toMatch(/>v5r</);
        expect(html).toContain('+1 more meaning');
    });

    it('shows the rare senses of a word that has nothing else', () => {
        const html = render(vocabulary({
            senses: [{ pos: ['n'], misc: { rawTags: ['arch'], isArchaic: true }, glosses: ['an old word'], related: { compounds: [] } }],
        }));
        expect(html).toContain('an old word');
        expect(html).toContain('Noun');
    });
});
