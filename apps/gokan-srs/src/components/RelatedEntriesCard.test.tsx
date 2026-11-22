import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RelatedEntriesCard } from './RelatedEntriesCard';

describe('RelatedEntriesCard', () => {
    it("puts the card's footer after the expand control, which follows the rows it expands", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <RelatedEntriesCard
                    title="Similar grammar"
                    sections={[{ entries: [{ key: 'a', to: '/grammar/a', primary: 'から' }], footer: <span>Section footer</span> }]}
                    isExpandable
                    onToggleExpand={() => undefined}
                    expandLabel="Show all 17"
                    footer={<a href="/grammar/drill/point/a">Drill against its siblings</a>}
                />
            </MemoryRouter>,
        );
        const row = html.indexOf('から');
        const sectionFooter = html.indexOf('Section footer');
        const expand = html.indexOf('Show all 17');
        const drill = html.indexOf('Drill against its siblings');
        expect(row).toBeGreaterThan(-1);
        expect(sectionFooter).toBeGreaterThan(row);
        expect(expand).toBeGreaterThan(sectionFooter);
        expect(drill).toBeGreaterThan(expand);
    });

    it('adds nothing after the expand control when its footer renders nothing (a point with no drill)', () => {
        const Nothing = () => null;
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <RelatedEntriesCard
                    title="Similar grammar"
                    sections={[{ entries: [{ key: 'a', to: '/grammar/a', primary: 'から' }] }]}
                    isExpandable
                    onToggleExpand={() => undefined}
                    expandLabel="Show all 17"
                    footer={<Nothing />}
                />
            </MemoryRouter>,
        );
        expect(html).toMatch(/Show all 17<\/button>(<\/div>)*<\/section>$/);
    });
});
