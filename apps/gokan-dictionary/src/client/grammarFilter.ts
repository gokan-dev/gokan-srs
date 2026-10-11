// The grammar index's filter (/grammar/): a text field and level toggles over the page's static
// rows, in plain TypeScript. No data download: every point is already on the page, so filtering
// only hides rows. The controls stay hidden without this script.

function init(): void {
    const root = document.querySelector<HTMLElement>('[data-grammar-filter]');
    const input = root?.querySelector('input');
    const count = root?.querySelector<HTMLElement>('[data-grammar-filter-count]');
    if (!root || !input || !count) return;

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-level]'));
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-level-section]')).map(section => ({
        section,
        level: section.dataset.levelSection,
        rows: Array.from(section.querySelectorAll('li')).map(row => ({ row, text: (row.textContent ?? '').normalize('NFKC').toLowerCase() })),
    }));
    const total = sections.reduce((sum, { rows }) => sum + rows.length, 0);

    function apply(): void {
        const query = input!.value.normalize('NFKC').trim().toLowerCase();
        const levels = new Set(buttons.filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.level));
        let shown = 0;
        for (const { section, level, rows } of sections) {
            let visible = 0;
            for (const { row, text } of rows) {
                const match = levels.has(level) && (!query || text.includes(query));
                row.hidden = !match;
                if (match) visible += 1;
            }
            section.hidden = visible === 0;
            shown += visible;
        }
        count!.textContent = shown === total ? '' : `${shown} of ${total} points`;
    }

    for (const button of buttons) {
        button.addEventListener('click', () => {
            button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
            apply();
        });
    }
    input.addEventListener('input', apply);
    root.hidden = false;
}

init();
