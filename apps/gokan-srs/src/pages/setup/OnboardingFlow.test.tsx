import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parseSetupLink } from '../../utils/setupLink.utils';
import { OnboardingFlow } from './OnboardingFlow';

// The two screens stand in as markers: what is tested is which one the flow opens on.
vi.mock('./WelcomeScreen', () => ({ WelcomeScreen: () => <p>welcome screen</p> }));
vi.mock('./SetupScreen', () => ({ SetupScreen: () => <p>setup screen</p> }));

const render = (search: string) => renderToStaticMarkup(<OnboardingFlow link={parseSetupLink(search)} onComplete={() => undefined} />);

describe('OnboardingFlow', () => {
    it('opens on setup when the link carries a kanji count ("Start after step 103")', () => {
        expect(render('?order=kklc&known=103&utm_source=dictionary&utm_content=word')).toBe('<p>setup screen</p>');
    });

    it('opens on the welcome for an order alone and for a direct visit', () => {
        expect(render('?order=kklc&utm_source=dictionary&utm_content=order')).toBe('<p>welcome screen</p>');
        expect(render('')).toBe('<p>welcome screen</p>');
    });
});
