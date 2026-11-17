import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { KanjiFormContextValue } from '../../context/KanjiForm/KanjiFormContext';
import { parseSetupLink } from '../../utils/setupLink.utils';
import { OnboardingFlow } from './OnboardingFlow';

const form: KanjiFormContextValue = {
    state: { allKanji: ['一', '二'], kanjiCount: 2, knownPrefix: 2, knownKanji: new Set(['一', '二']), kanjiMethod: 'kklc', loading: false },
    setKanjiCount: () => undefined,
    toggleKanji: () => undefined,
    setKanjiMethod: () => undefined,
    resetKanji: () => undefined,
};

vi.mock('../../context/KanjiForm/useKanjiForm', () => ({ useKanjiForm: () => form }));
vi.mock('../../context/Responsive/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }));
// The Drive restore stands in as a marker: what is tested is that the first screen offers it.
vi.mock('./welcome/GoogleLoginButton', () => ({ RestorePrompt: () => <span>drive restore</span> }));

const render = (search: string) => renderToStaticMarkup(
    <MemoryRouter><OnboardingFlow link={parseSetupLink(search)} onComplete={() => undefined} /></MemoryRouter>,
);
const WELCOME = "I'm just starting out";
const SETUP = 'Start learning';

describe('OnboardingFlow', () => {
    it('opens on setup when the link carries a kanji count ("Start after step 103")', () => {
        const html = render('?order=kklc&known=103&utm_source=dictionary&utm_content=word');
        expect(html).toContain(SETUP);
        expect(html).not.toContain(WELCOME.replace("'", '&#x27;'));
    });

    it('opens on the welcome for an order alone and for a direct visit', () => {
        for (const search of ['?order=kklc&utm_source=dictionary&utm_content=order', '']) {
            const html = render(search);
            expect(html).toContain(WELCOME.replace("'", '&#x27;'));
            expect(html).not.toContain(SETUP);
        }
    });

    it('offers the Drive restore on whichever screen opens first', () => {
        for (const search of ['?order=kklc&known=103', '?order=kklc', '']) {
            expect(render(search)).toContain('drive restore');
        }
    });

    it('puts setup\'s restore under Start learning, so it never pushes the count down', () => {
        const html = render('?order=kklc&known=103');
        expect(html.indexOf('id="kanji-count"')).toBeLessThan(html.indexOf(SETUP));
        expect(html.indexOf(SETUP)).toBeLessThan(html.indexOf('drive restore'));
    });
});
