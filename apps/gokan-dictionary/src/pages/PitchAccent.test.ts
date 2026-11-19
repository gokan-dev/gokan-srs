import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { PITCH_LINE_PX, PITCH_OTHER_SCALE, pitchPaths } from '@gokan/dataset-schema';
import type { VocabPageProps } from '../lib/pageProps';
import { wordSynonyms } from '../lib/synonyms';
import { vocabulary } from '../test/fixtures';
import Localized from '../test/Localized.svelte';
import PitchAccent from './PitchAccent.svelte';
import VocabPage from './VocabPage.svelte';

const accent = { reading: 'あのひと', downsteps: [2, 0], source: 'wiktionary' as const };
const markup = () => render(PitchAccent, { props: { accent, label: 'Pitch accent' } }).body.replace(/<!--.*?-->/g, '');
const wordPage = (audio: boolean = true) => {
    const vocab = vocabulary({ reading: { primary: 'あのひと', alternatives: [] }, pitchAccent: [accent], ...(audio ? { audio: { clip: 'v/1' } } : {}) });
    const props: VocabPageProps = {
        vocab, orderStep: null, components: [], parents: [], sentences: [], synonyms: wordSynonyms(vocab, () => true),
        voice: { extension: 'mp3', credit: 'VOICEVOX', termsUrl: 'https://example.org/terms' },
    };
    return render(Localized<VocabPageProps>, { props: { locale: 'en', page: VocabPage, props } }).body.replace(/<!--.*?-->/g, '');
};

describe('PitchAccent', () => {
    it('hides every graph from screen readers, which hear the reading once and the label', () => {
        const svgs = markup().match(/<svg[^>]*>/g) ?? [];
        expect(svgs).toHaveLength(2);
        for (const svg of svgs) expect(svg).toContain('aria-hidden="true"');
    });

    it("puts the reading's play button right after the first pattern, a further one after it", () => {
        const head = /<p class="entry-sub"[^>]*>.*?<\/p>/s.exec(wordPage())?.[0] ?? '';
        expect(head).toContain('class="pa pa-b"');
        expect(head).toMatch(/data-pitch-reading[^>]*>あのひと<\/span><span class="visually-hidden">[^<]*<\/span><\/span><button class="play"[^>]*><\/button><span aria-hidden="true"><span class="pr pr-other"/);
    });

    it('leaves no room for a play button when the word has no clip', () => {
        const head = /<p class="entry-sub"[^>]*>.*?<\/p>/s.exec(wordPage(false))?.[0] ?? '';
        expect(head).toContain('class="pa"');
        expect(head).not.toContain('<button');
    });
});

describe('vocab.scss', () => {
    // The stylesheet writes pitchPaths' sizes out for bytes: a change to the package's geometry
    // fails here rather than clipping or misaligning the dots on 35,000 pages.
    const scss = readFileSync(new URL('../styles/pages/vocab.scss', import.meta.url), 'utf8');
    const p = pitchPaths('はし', 0);
    const value = (pattern: RegExp) => Number(pattern.exec(scss)?.[1]);

    it("draws the pitch graph at the package's sizes", () => {
        expect(value(/\.pr \{[^}]*?padding: ([\d.]+)em/)).toBe(Number(p.height));
        expect(value(/\.pr \{[^}]*?padding: [\d.]+em ([\d.]+)em/)).toBe(Number(p.padRight));
        expect(value(/svg \{[^}]*?height: ([\d.]+)em/)).toBe(Number(p.height));
        expect(value(/\.pd \{[^}]*?stroke-width: ([\d.]+)/)).toBe(Number(p.dot));
        expect(value(/circle \{[^}]*?stroke-width: ([\d.]+)/)).toBe(PITCH_LINE_PX);
        expect(value(/\.pr-other \{[^}]*?min\(([\d.]+)em/)).toBe(PITCH_OTHER_SCALE);
    });

    it("starts a later pattern after the row's gap, with no margin a wrap would keep", () => {
        expect(scss).toMatch(/\.pa \{[^}]*?column-gap: \$space-2;/);
        expect(scss).not.toMatch(/\.pr-other \{[^}]*?margin/);
    });

    it('pulls the play button back to the space before it, inside the row gap', () => {
        expect(scss).toMatch(/\.pa-b > \.pr:first-child \{[\s\S]*?\n {2}\+ \.play \{\s*margin-inline-start: -\(\$space-2 - \$space-half\);/);
    });
});
