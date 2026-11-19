import type { Vocabulary } from '@gokan/dataset-schema';
import type { UserSettings } from '../../models/user.model';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { userSettings, vocabulary } from '../../test/fixtures';
import { LookupCardBody } from './LookupCardBody';

let loaded: Vocabulary = vocabulary();
let settings: UserSettings | null = null;

vi.mock('../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress: null, settings, session: null, grammarSession: null }, actions: {} }),
}));
// The real button subscribes to the clip player, which a static render has no snapshot of.
vi.mock('../PlayButton', () => ({
    PlayButton: ({ label, className = '' }: { label: string; className?: string }) => <button aria-label={label} className={className} />,
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
    describe('pitch accent', () => {
        const hashi = (): Vocabulary => vocabulary({
            writtenForm: { kanji: '橋', alternatives: [], containedKanji: ['橋'] },
            reading: { primary: 'はし', alternatives: [] },
            pitchAccent: [{ reading: 'はし', downsteps: [2], source: 'wiktionary' }],
        });

        it('draws the pattern over the reading, in place of the plain reading, named for screen readers', () => {
            settings = null;
            const html = render(hashi());
            expect(html).toContain('data-pitch-accent');
            expect(html).toContain('Pitch accent: drop after mora 2');
            expect(html.match(/>はし</g)).toHaveLength(1);
        });

        it('puts the play button right after the first pattern, so a second one wraps after it', () => {
            settings = null;
            const html = render({ ...hashi(), audio: { clip: 'clip-hashi' }, pitchAccent: [{ reading: 'はし', downsteps: [2, 0], source: 'wiktionary' }] });
            const group = /<span data-pitch-accent[\s\S]*$/.exec(html)?.[0] ?? '';
            // The first pattern closes (its reading, then its screen-reader words), then the button.
            expect(group).toMatch(/data-pitch-reading[^>]*>はし<\/span><span class="sr-only">[^<]*<\/span><\/span><button[^>]*aria-label="Play 橋"/);
        });

        it('keeps the kanji spelling of a word learned in kana, then its reading with the pattern', () => {
            settings = null;
            const html = render({
                ...hashi(),
                writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] },
                reading: { primary: 'ここ', alternatives: [] },
                usuallyKana: true,
                pitchAccent: [{ reading: 'ここ', downsteps: [0], source: 'wiktionary' }],
            });
            expect(html).toContain('>此処<');
            expect(html).toContain('Pitch accent: heiban');
        });

        it('draws every pattern of a word with several', () => {
            settings = null;
            const html = render({ ...hashi(), pitchAccent: [{ reading: 'はし', downsteps: [2, 0], source: 'wiktionary' }] });
            expect(html.match(/<svg/g)).toHaveLength(2);
            expect(html).toContain('Pitch accent: drop after mora 2, or heiban');
        });

        it('shows nothing when the learner turned it off, or the dataset has none', () => {
            settings = userSettings({ showPitchAccent: false });
            expect(render(hashi())).not.toContain('data-pitch-accent');
            settings = null;
            const { pitchAccent: _none, ...bare } = hashi();
            expect(render(bare)).not.toContain('data-pitch-accent');
        });
    });
});
