// Pitch accent as both apps draw it (gokan-srs issue 176): a dot over each mora of the reading,
// high or low, joined by a line, with a hollow dot for the particle after the word, since only the
// particle tells heiban (端, it stays high) from odaka (橋, it drops). Each app draws `pitchGraph`'s
// points over its own reading text and words `downstep` in its own language; nothing here is copy.

import type { PitchAccent, Vocabulary } from './vocabulary';

const SMALL_KANA = new Set([...'ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ']);

/** A reading's morae: a small ゃゅょ (and ぁぃぅぇぉゎ) joins the kana before it; っ, ん and ー are morae of their own. */
export function moraeOf(reading: string): string[] {
    const out: string[] = [];
    for (const ch of reading) {
        const last = out.length - 1;
        if (SMALL_KANA.has(ch) && last >= 0) out[last] += ch;
        else out.push(ch);
    }
    return out;
}

export interface PitchContour {
    /** Each mora and whether it is high. */
    morae: { kana: string; high: boolean }[];
    /** Whether a particle after the word is high: only for heiban. */
    particleHigh: boolean;
}

/**
 * Where each mora sits for a downstep: mora 1 is high only when the word drops after it (1);
 * from mora 2 a mora is high up to and including the downstep (every one for 0, heiban).
 */
export function pitchContour(reading: string, downstep: number): PitchContour {
    const morae = moraeOf(reading).map((kana, i) => ({
        kana,
        high: downstep === 1 ? i === 0 : i > 0 && (downstep === 0 || i < downstep),
    }));
    return { morae, particleHigh: downstep === 0 };
}

/** The usual names, for a word page or a lesson that wants them. */
export type PitchAccentKind = 'heiban' | 'atamadaka' | 'nakadaka' | 'odaka';

export function pitchAccentKind(reading: string, downstep: number): PitchAccentKind {
    if (downstep === 0) return 'heiban';
    if (downstep === 1) return 'atamadaka';
    return downstep >= moraeOf(reading).length ? 'odaka' : 'nakadaka';
}

/** The accent of a word's primary reading, when a source gives it. */
export function primaryPitchAccent(vocab: Pick<Vocabulary, 'reading' | 'pitchAccent'>): PitchAccent | undefined {
    return vocab.pitchAccent?.find(a => a.reading === vocab.reading.primary);
}

/** One point of a pitch graph, in its own units (an SVG viewBox). */
/** One point of a pitch graph, in em of the reading it is drawn over (an SVG viewBox). */
export interface PitchGraphPoint {
    x: number;
    y: number;
    high: boolean;
    /** The particle after the word, drawn hollow, past the reading's end. */
    particle?: true;
}

/**
 * The dots over a reading, in em of its font: each kana is 1em wide (a Japanese font's kana and
 * ー are full-width), so a mora's dot sits over the middle of its kana with no measuring, at any
 * size. The graph is `height` em tall, drawn over the reading, and `width` em wide: the reading
 * and one more em for the particle's dot.
 */
export interface PitchGraph {
    width: number;
    height: number;
    points: PitchGraphPoint[];
    /**
     * The line between consecutive points. The one into the particle stops at its edge, so its
     * dot stays hollow on whatever it is drawn on, with no fill to match the background.
     */
    segments: { x1: number; y1: number; x2: number; y2: number }[];
    /** The dots' radius. */
    radius: number;
}

const HIGH_Y = 0.12;
const LOW_Y = 0.44;
const HEIGHT = 0.56;
const RADIUS = 0.12;

/** Three decimals of an em: the dictionary's pages are byte-reproducible, so no float noise reaches its markup. */
const round = (n: number) => Math.round(n * 1000) / 1000;

/** The graph of one downstep of a reading, to be drawn over its text. */
export function pitchGraph(reading: string, downstep: number): PitchGraph {
    const contour = pitchContour(reading, downstep);
    const points: PitchGraphPoint[] = [];
    let x = 0;
    for (const { kana, high } of contour.morae) {
        const width = [...kana].length;
        points.push({ x: x + width / 2, y: high ? HIGH_Y : LOW_Y, high });
        x += width;
    }
    points.push({ x: x + 0.5, y: contour.particleHigh ? HIGH_Y : LOW_Y, high: contour.particleHigh, particle: true });
    const segments = points.slice(1).map((to, i) => {
        const from = points[i] ?? to;
        if (!to.particle) return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        const cut = length === 0 ? 0 : RADIUS / length;
        return { x1: from.x, y1: from.y, x2: round(to.x - (to.x - from.x) * cut), y2: round(to.y - (to.y - from.y) * cut) };
    });
    return { width: x + 1, height: HEIGHT, points, segments, radius: RADIUS };
}

/** A number as short as SVG reads it: `0.44` as `.44`, `-0.32` as `-.32`. */
const short = (n: number) => String(round(n)).replace(/^(-?)0\./, '$1.');

/**
 * A pitch graph as the fewest bytes of SVG: the dictionary puts one on each of its 35,000 word
 * pages, held to a size budget (lib/budgets.ts), and one element per segment and dot cost 0.8 KB.
 * `line` is one path through every dot, ending at the particle's edge; `dots` draws every mora's
 * dot as a zero-length stroke with round caps (so its stroke width is the dot's diameter,
 * `2 * radius`); `particle` is the hollow dot's centre. Coordinates are relative after the first.
 */
export interface PitchPaths {
    width: number;
    line: string;
    dots: string;
    particle: { cx: string; cy: string };
    radius: string;
}

export function pitchPaths(reading: string, downstep: number): PitchPaths {
    const g = pitchGraph(reading, downstep);
    const morae = g.points.filter(p => !p.particle);
    const particle = g.points[g.points.length - 1] ?? { x: 0, y: 0 };
    const relative = (from: { x: number; y: number }, to: { x: number; y: number }) => `${short(to.x - from.x)} ${short(to.y - from.y)}`;
    const ends = [...g.segments.map(s => ({ x: s.x2, y: s.y2 }))];
    const first = morae[0] ?? particle;
    const line = `M${short(first.x)} ${short(first.y)}l${ends.map((p, i) => relative(i === 0 ? first : ends[i - 1] ?? first, p)).join(' ')}`;
    const dots = `M${short(first.x)} ${short(first.y)}h0${morae.slice(1).map((p, i) => `m${relative(morae[i] ?? first, p)}h0`).join('')}`;
    return { width: g.width, line, dots, particle: { cx: short(particle.x), cy: short(particle.y) }, radius: short(g.radius) };
}
