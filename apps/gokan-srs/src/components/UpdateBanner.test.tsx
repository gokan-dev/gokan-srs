import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { UpdateBanner, UpdateNotice } from './UpdateBanner';
import { AppFooter } from './nav/AppFooter';
import { AboutScreen } from '../pages/about/AboutScreen';
import { APP_VERSION } from '../services/release.service';
import { initialState, type QuizState } from '../context/quiz/quizReducer';

let available: string | null = null;
const dismiss = vi.fn();

let quizState: QuizState = initialState;

vi.mock('../hooks/useUpdateAvailable', () => ({
    useUpdateAvailable: () => ({ version: available, dismiss }),
}));
vi.mock('../context/useQuiz', () => ({
    useQuiz: () => ({ state: quizState }),
}));

const render = (node: ReactNode, path = '/') => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);

/** The button labelled `label` in a rendered notice, found in its element tree. */
function buttonNamed(node: ReactNode, label: string): ReactElement<{ onClick: () => void }> | null {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void; 'aria-label'?: string }>(node)) return null;
    const { children, onClick } = node.props;
    if (onClick && (children === label || node.props['aria-label'] === label)) return node as ReactElement<{ onClick: () => void }>;
    for (const child of Array.isArray(children) ? children : [children]) {
        const found = buttonNamed(child as ReactNode, label);
        if (found) return found;
    }
    return null;
}

describe('UpdateBanner', () => {
    it('stays hidden while the tab runs the live version', () => {
        available = null;
        expect(render(<UpdateBanner />)).toBe('');
    });

    it('appears once a newer version is live, naming it', () => {
        available = '9.9.0';
        quizState = initialState;
        const html = render(<UpdateBanner />);
        expect(html).toContain('A new version is available (version 9.9.0).');
        expect(html).toContain('Reload');
        expect(html).toContain('href="/whats-new"');
    });

    it('waits while a session is paused on a consult page, vocab or grammar: a reload would end it', () => {
        available = '9.9.0';
        for (const paused of [{ session: { committed: [], suspendedAt: 1 } }, { grammarSession: { committed: [], suspendedAt: 1 } }]) {
            quizState = { ...initialState, ...paused };
            expect(render(<UpdateBanner />, '/vocab/1')).toBe('');
        }
        quizState = initialState;
    });

    it("offers no link to What's new on What's new itself", () => {
        available = '9.9.0';
        quizState = initialState;
        const html = render(<UpdateBanner />, '/whats-new');
        expect(html).toContain('Reload');
        expect(html).not.toContain('href="/whats-new"');
    });
});

describe('UpdateNotice', () => {
    it('reloads on Reload and hides on Dismiss, nothing on its own', () => {
        const onReload = vi.fn();
        const onDismiss = vi.fn();
        const notice = UpdateNotice({ version: '9.9.0', linkWhatsNew: true, onReload, onDismiss });
        expect(onReload).not.toHaveBeenCalled();
        buttonNamed(notice, 'Reload')?.props.onClick();
        expect(onReload).toHaveBeenCalledOnce();
        buttonNamed(notice, 'Dismiss')?.props.onClick();
        expect(onDismiss).toHaveBeenCalledOnce();
    });
});

describe('the version line', () => {
    it('is in the footer and on About, beside the way to What\'s new', () => {
        for (const html of [render(<AppFooter alwaysVisible />), render(<AboutScreen />)]) {
            expect(html).toContain(`ersion ${APP_VERSION}`);
            expect(html).toContain('href="/whats-new"');
        }
    });
});
