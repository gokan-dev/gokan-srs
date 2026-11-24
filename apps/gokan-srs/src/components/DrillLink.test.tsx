// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrillLink } from './DrillLink';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const hasDrill = vi.fn<() => Promise<boolean>>();
vi.mock('../context/quiz/drillSelectors', () => ({ hasDrill: () => hasDrill() }));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); hasDrill.mockReset(); });

async function render(node: ReactNode) {
    await act(async () => { root.render(<MemoryRouter>{node}</MemoryRouter>); await Promise.resolve(); });
}

const set = { kind: 'lesson', familyId: 'who', lessonId: 'someone-anyone-no-one' } as const;
const fallback = <p>No drill yet for this lesson.</p>;

describe('DrillLink', () => {
    it('says a lesson has no drill yet once that is known, in place of the button', async () => {
        hasDrill.mockResolvedValue(false);
        await render(<DrillLink set={set} label="Drill this lesson" fallback={fallback} />);
        expect(container.textContent).toBe('No drill yet for this lesson.');
        expect(container.querySelector('a')).toBeNull();
    });

    it('shows nothing while it is not known yet', async () => {
        hasDrill.mockReturnValue(new Promise(() => {}));
        await render(<DrillLink set={set} label="Drill this lesson" fallback={fallback} />);
        expect(container.innerHTML).toBe('');
    });

    it('links to the drill when it has cards, as a button or as a small text link', async () => {
        hasDrill.mockResolvedValue(true);
        await render(<DrillLink set={{ kind: 'point', grammarId: 'n5-091' }} label="Drill" text name="Drill だれか against its siblings" />);
        const link = container.querySelector('a');
        expect(link?.getAttribute('href')).toBe('/grammar/drill/point/n5-091');
        expect(link?.className).toContain('text-accent');
        expect(link?.className).toContain('min-h-11');
        // Every chapter row's link reads "Drill": its accessible name says which point it drills.
        expect(link?.textContent).toBe('Drill');
        expect(link?.getAttribute('aria-label')).toBe('Drill だれか against its siblings');
    });
});
