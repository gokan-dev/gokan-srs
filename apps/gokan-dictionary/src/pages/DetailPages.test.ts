import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { GrammarExample } from '@gokan/dataset-schema';
import { grammarPoint, kanji } from '../test/fixtures';
import Localized from '../test/Localized.svelte';
import type { GrammarPageProps, KanjiPageProps } from '../lib/pageProps';
import type { VocabSummary } from '../lib/types';
import GrammarPage from './GrammarPage.svelte';
import KanjiPage from './KanjiPage.svelte';

const word = (id: string): VocabSummary => ({ id, word: `${id}学`, gloss: `gloss ${id}` });
const example = (i: number): GrammarExample => ({ jp: `例${i}`, romaji: `rei ${i}`, en: `Example ${i}.`, words: [{ surface: `例${i}`, vocabId: null }], patternWordIndices: [] });

function kanjiProps(words: number): KanjiPageProps {
    return { kanji: kanji(), words: Array.from({ length: words }, (_, i) => word(`${i + 1}`)), kanjiWithPages: new Set(['学', '子']), orderLengths: new Map(), orderStep: null };
}
function grammarProps(examples: number, mined: number, related = true, minedTotal = mined): GrammarPageProps {
    return {
        point: grammarPoint({ examples: Array.from({ length: examples }, (_, i) => example(i)) }),
        related: [], chapterLocator: null, variants: related ? [{ id: 'n2-170', title: '～を問わない', relation: 'negation', jlptLevel: 2 }] : [], conjugation: null,
        minedExamples: Array.from({ length: mined }, (_, i) => example(100 + i)), minedExamplesTotalCount: minedTotal, voice: null,
    };
}

/** The page's markup, without Svelte's hydration comments. */
const kanjiHtml = (props: KanjiPageProps) => render(Localized<KanjiPageProps>, { props: { locale: 'en', page: KanjiPage, props } }).body.replace(/<!--.*?-->/g, '');
const grammarHtml = (props: GrammarPageProps) => render(Localized<GrammarPageProps>, { props: { locale: 'en', page: GrammarPage, props } }).body.replace(/<!--.*?-->/g, '');
const tabsOf = (body: string) => Array.from(body.matchAll(/data-tab="([a-z]+)"/g), match => match[1]);
const panelsOf = (body: string) => Array.from(body.matchAll(/id="([a-z]+)" class="[^"]*detail-panel/g), match => match[1]);

describe('KanjiPage', () => {
    it("has the app kanji page's tabs, each a panel, Kanji the default", () => {
        const body = kanjiHtml(kanjiProps(40));
        expect(tabsOf(body)).toEqual(['kanji', 'words']);
        expect(panelsOf(body)).toEqual(['kanji', 'words']);
        expect(body).toMatch(/id="kanji" class="detail-panel" data-default-panel/);
    });

    it('previews the 5 most common words in the Kanji tab, linking to Words, which lists them all and is searchable past its first rows', () => {
        const body = kanjiHtml(kanjiProps(40));
        const preview = body.slice(body.indexOf('detail-preview'), body.indexOf('In kanji courses'));
        expect(preview.match(/<li>/g)?.length).toBe(5);
        expect(preview).toContain('href="#words">All 40 words →');
        expect(body.slice(body.indexOf('id="words"'))).toContain('data-section-search=');
        expect(kanjiHtml(kanjiProps(10))).not.toContain('data-section-search=');
    });

    it('folds the readings in names and the radical number into Details, and leaves a kanji with no word without a tab row, saying it has none', () => {
        const body = kanjiHtml(kanjiProps(0));
        expect(body).toContain('<summary>Details</summary>');
        expect(body).toContain('Kangxi radical');
        expect(tabsOf(body)).toEqual([]);
        expect(body).not.toContain('detail-preview');
        expect(body).toMatch(/<section class="section"><div class="section-head"><h2>Common words<\/h2><\/div> <p class="support">No word in this dictionary uses this kanji yet\.<\/p><\/section>/);
        expect(kanjiHtml(kanjiProps(1))).not.toContain('No word in this dictionary');
    });

    it('states how common, the school grade, the strokes and the radical in the facts row', () => {
        const facts = /<dl class="entry-facts">(.*?)<\/dl>/s.exec(kanjiHtml(kanjiProps(1)))?.[1] ?? '';
        expect(Array.from(facts.matchAll(/<dt>([^<]*)<\/dt>/g), match => match[1])).toEqual(['How common', 'School grade', 'Strokes', 'Radical']);
        expect(facts).toContain('Top 100 kanji');
    });
});

describe('GrammarPage', () => {
    it("has the app grammar page's tabs, each only when it has content", () => {
        expect(tabsOf(grammarHtml(grammarProps(3, 2)))).toEqual(['point', 'examples', 'related']);
        expect(panelsOf(grammarHtml(grammarProps(3, 2)))).toEqual(['point', 'examples', 'related']);
        expect(tabsOf(grammarHtml(grammarProps(3, 0, false)))).toEqual(['point', 'examples']);
        expect(tabsOf(grammarHtml(grammarProps(0, 0, false)))).toEqual([]);
    });

    it('previews 2 examples in Point, linking to Examples, which holds every example, curated then the corpus, searchable', () => {
        const body = grammarHtml(grammarProps(3, 2));
        const preview = body.slice(body.indexOf('detail-preview'), body.indexOf('id="examples"'));
        expect(preview.match(/<li>/g)?.length).toBe(2);
        expect(preview).toContain('href="#examples">All 5 examples →');
        const examples = body.slice(body.indexOf('id="examples"'), body.indexOf('id="related"'));
        expect(examples.match(/<li>/g)?.length).toBe(5);
        expect(examples).toContain('data-section-search=');
        expect(grammarHtml(grammarProps(3, 0))).not.toContain('data-section-search=');
    });

    it('previews a point with only corpus examples in Point too, linking to Examples', () => {
        const body = grammarHtml(grammarProps(0, 3));
        const preview = body.slice(body.indexOf('detail-preview'), body.indexOf('id="examples"'));
        expect(preview.match(/<li>/g)?.length).toBe(2);
        expect(preview).toContain('Example 100.');
        expect(preview).toContain('href="#examples">All 3 examples →');
    });

    it('counts every corpus example in "All N examples", not only the rows the page ships', () => {
        const body = grammarHtml(grammarProps(5, 25, true, 1412));
        const preview = body.slice(body.indexOf('detail-preview'), body.indexOf('id="examples"'));
        expect(preview).toContain('href="#examples">All 1,417 examples →');
        // The same count, written the same way, one tap later.
        expect(body).toContain('Corpus examples (1,412)');
        expect(body).toContain('Showing 25 of 1,412 corpus examples.');
    });

    it('keeps the full explanation in place under the short one', () => {
        const body = grammarHtml(grammarProps(1, 0));
        expect(body.indexOf('Read the full explanation')).toBeGreaterThan(body.indexOf('class="lead"'));
        expect(body.indexOf('Read the full explanation')).toBeLessThan(body.indexOf('app-panel'));
    });
});

describe('GrammarPage play buttons', () => {
    const voice = { extension: 'opus', credit: 'VOICEVOX:冥鳴ひまり', termsUrl: 'https://voice.test/terms' };

    it('plays each example with a clip, curated or from the corpus, beside its first line; one without has none', () => {
        const props = grammarProps(2, 1);
        props.point.examples[0] = { ...props.point.examples[0], audio: { clip: 'cccccccccccccccc' } };
        props.minedExamples[0] = { ...props.minedExamples[0], audio: { clip: 'dddddddddddddddd' } };
        const body = grammarHtml({ ...props, voice });
        const clips = Array.from(body.matchAll(/<div class="play-row"><p class="sentence-jp" lang="ja">.*?<\/p><button type="button" class="play" data-clip="([^"]*)" aria-label="Play sentence"/g), match => match[1]);
        // The Point tab's preview (the first two examples) and the Examples tab both list the first.
        expect(clips).toEqual(['/audio/cccccccccccccccc.opus', '/audio/cccccccccccccccc.opus', '/audio/dddddddddddddddd.opus']);
        expect(body).toContain('VOICEVOX:冥鳴ひまり');
        expect(grammarHtml(grammarProps(2, 1))).not.toContain('class="play');
    });
});
