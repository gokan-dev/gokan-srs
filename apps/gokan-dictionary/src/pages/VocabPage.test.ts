import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Sentence, VocabSynonym } from '@gokan/dataset-schema';
import { sentence, vocabulary, wordText } from '../test/fixtures';
import Localized from '../test/Localized.svelte';
import type { ServedLocale } from '../lib/locale';
import type { VocabPageProps } from '../lib/pageProps';
import { wordSynonyms } from '../lib/synonyms';
import type { VocabSummary } from '../lib/types';
import VocabPage from './VocabPage.svelte';

const synonym = (id: string): VocabSynonym => ({ id, relation: 'confusable', shared: ['think'], w: [`${id}字`], r: [`${id}よみ`], f: 100 });
const word = (id: string): VocabSummary => ({ id, word: `${id}字`, gloss: id });
const sentences = (n: number): Sentence[] => Array.from({ length: n }, (_, i) => sentence({ id: `s${i}` }));

/** A word page's props: 思う with `n` of each row the searchable sections list. */
function props(n: number, chinese = false): VocabPageProps {
    const vocab = vocabulary({ synonyms: Array.from({ length: n }, (_, i) => synonym(`${i + 100}`)) });
    const list = sentences(n);
    return {
        vocab, orderStep: null, components: Array.from({ length: n }, (_, i) => word(`${i + 200}`)), parents: [], sentences: list,
        synonyms: wordSynonyms(vocab, () => true),
        voice: null,
        ...(chinese ? {
            text: wordText(),
            translations: Object.fromEntries(list.map(s => [s.id, { lang: 'zh-hans' as const, text: '我也这么想。', source: { source: 'tatoeba-cmn', ref: s.id } }])),
            withoutPage: { words: [], kanji: [] },
        } : {}),
    };
}
/** The page's markup, without Svelte's hydration comments. */
const html = (locale: ServedLocale, pageProps: VocabPageProps) => render(Localized<VocabPageProps>, { props: { locale, page: VocabPage, props: pageProps } }).body.replace(/<!--.*?-->/g, '');
/** The markup of the element with this id, up to the next section's. */
const sectionOf = (body: string, id: string, next: string) => body.slice(body.indexOf(`id="${id}"`), body.indexOf(`id="${next}"`));

describe('VocabPage', () => {
    it('shows a section search only past one page, as the app does, with a placeholder in each locale', () => {
        for (const locale of ['en', 'zh-hans'] as const) {
            expect(html(locale, props(3, locale !== 'en'))).not.toContain('data-section-search=');
            const many = html(locale, props(12, locale !== 'en'));
            expect(many.match(/data-section-search=/g)?.length).toBe(3);
            for (const [, placeholder] of many.matchAll(/data-section-search=[^]*?placeholder="([^"]*)"/g)) expect(placeholder.trim()).not.toBe('');
        }
    });

    it("says each section search's languages: on a Chinese page, Synonyms (English meanings, Japanese words) does not claim Chinese", () => {
        const placeholders = (locale: ServedLocale) => Array.from(html(locale, props(12, locale !== 'en')).matchAll(/data-section-search=[^]*?placeholder="([^"]*)"/g), match => match[1]);
        expect(placeholders('en')).toEqual(Array(3).fill('Search in English or Japanese'));
        expect(placeholders('zh-hans')).toEqual(['用中文、英文或日文搜索', '用英文或日文搜索', '用中文、英文或日文搜索']);
    });

    it("credits the Tatoeba sentences Dict's Examples show, in Dict, as Sentences credits its own", () => {
        const body = html('zh-hans', props(3, true));
        expect(sectionOf(body, 'dict', 'sentences')).toContain('source-credit');
        expect(sectionOf(body, 'dict', 'sentences')).toContain('Tatoeba');
    });

    it("gives a synonym row its shared meanings as its gloss and its closeness as a note a search does not read", () => {
        const row = /<li><a [^>]*>100字<span>100よみ<\/span>(.*?)<\/a><\/li>/.exec(html('en', props(1)))?.[1];
        expect(row).toBe('<span lang="en">think</span><small lang="en">≈ Close in this sense</small>');
    });

    describe('play buttons', () => {
        const voice = { extension: 'opus', credit: 'VOICEVOX:冥鳴ひまり', termsUrl: 'https://voice.test/terms' };
        /** 思う with a clip, and two sentences: the first with one, the second without. */
        function withClips(): VocabPageProps {
            const base = props(0);
            return {
                ...base,
                vocab: { ...base.vocab, audio: { clip: 'aaaaaaaaaaaaaaaa' } },
                sentences: [sentence({ id: 's1', audio: { clip: 'bbbbbbbbbbbbbbbb' } }), sentence({ id: 's2' })],
                voice,
            };
        }
        const buttons = (body: string) => Array.from(body.matchAll(/<button type="button" class="play" data-clip="([^"]*)" aria-label="([^"]*)" aria-pressed="false" lang="([^"]*)"><\/button>/g), match => match.slice(1));

        it("plays the word after its reading, and each sentence with a clip, by the clip's URL, in the page's language", () => {
            const body = html('en', withClips());
            const reading = /<p class="entry-sub" lang="ja">(.*?)<\/p>/.exec(body)?.[1] ?? '';
            expect(buttons(reading)).toEqual([['/audio/aaaaaaaaaaaaaaaa.opus', 'Play 思う', 'en']]);
            // Dict's Examples and Sentences show the same first sentence: each gives it its button, the second none.
            expect(buttons(sectionOf(body, 'sentences', 'synonyms')).map(([url, label]) => [url, label])).toEqual([['/audio/bbbbbbbbbbbbbbbb.opus', 'Play sentence']]);
            expect(buttons(sectionOf(body, 'dict', 'sentences'))).toHaveLength(1);
            const chinese = { ...props(0, true), vocab: withClips().vocab, sentences: withClips().sentences, voice };
            expect(buttons(html('zh-hans', chinese)).map(([, label, lang]) => [label, lang])).toEqual([['播放思う', 'zh-Hans'], ['播放例句', 'zh-Hans'], ['播放例句', 'zh-Hans']]);
        });

        it('credits the voice in the footer, from the index, linked to its terms', () => {
            expect(html('en', withClips())).toMatch(/<footer[^]*Audio: <a href="https:\/\/voice\.test\/terms" lang="ja"[^>]*>VOICEVOX:冥鳴ひまり<\/a>\.<\/p>/);
        });

        it('has no button, and no credit, on a page that plays nothing', () => {
            const silent = { ...withClips(), voice: null };
            expect(html('en', silent)).not.toContain('class="play"');
            expect(html('en', silent)).not.toContain('VOICEVOX');
            // A word without a clip on a page with others: none of its own, never a disabled one.
            const body = html('en', { ...withClips(), vocab: props(0).vocab });
            expect(/<p class="entry-sub" lang="ja">(.*?)<\/p>/.exec(body)?.[1]).not.toContain('<button');
        });
    });
});
