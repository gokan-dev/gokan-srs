// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnswerInput } from './AnswerInput';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
/** Every value the field reported, the last one being the answer in state. */
let reported: string[];

function Field({ convertsRomaji }: { convertsRomaji: boolean }) {
    const [value, setValue] = useState('');
    return (
        <AnswerInput
            value={value}
            convertsRomaji={convertsRomaji}
            onValueChange={(next) => {
                reported.push(next);
                setValue(next);
            }}
        />
    );
}

function mount(convertsRomaji: boolean): HTMLInputElement {
    act(() => root.render(<Field convertsRomaji={convertsRomaji} />));
    const input = container.querySelector('input');
    if (!input) throw new Error('no input rendered');
    return input;
}

const setNativeValue = (input: HTMLInputElement, value: string) =>
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);

/** One input event, as a browser fires it after a key: the new text, the caret after it. */
function input(field: HTMLInputElement, value: string, caret = value.length, isComposing = false) {
    act(() => {
        setNativeValue(field, value);
        field.setSelectionRange(caret, caret);
        field.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing }));
    });
}

function fire(field: HTMLInputElement, event: Event) {
    act(() => { field.dispatchEvent(event); });
}

/** Types `keys` at the caret, one key at a time. */
function type(field: HTMLInputElement, keys: string) {
    for (const key of keys) {
        const caret = field.selectionStart ?? field.value.length;
        input(field, field.value.slice(0, caret) + key + field.value.slice(caret), caret + 1);
    }
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    reported = [];
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('AnswerInput on an English answer', () => {
    it('never converts', () => {
        const field = mount(false);
        type(field, 'to eat');
        expect(field.value).toBe('to eat');
        fire(field, new FocusEvent('focusout', { bubbles: true }));
        expect(reported.at(-1)).toBe('to eat');
    });
});

describe('AnswerInput on a Japanese answer', () => {
    it('converts romaji as it is typed', () => {
        const field = mount(true);
        type(field, 'tab');
        expect(field.value).toBe('たb');
        type(field, 'eru');
        expect(field.value).toBe('たべる');
        expect(reported.at(-1)).toBe('たべる');
    });

    it('keeps the caret where the text was typed', () => {
        const field = mount(true);
        type(field, 'taru');
        act(() => { field.setSelectionRange(1, 1); });
        type(field, 'be');
        expect(field.value).toBe('たべる');
        expect(field.selectionStart).toBe(2);
    });

    it('reads a final n as ん when the field is left', () => {
        const field = mount(true);
        type(field, 'hon');
        expect(field.value).toBe('ほn');
        fire(field, new FocusEvent('focusout', { bubbles: true }));
        expect(reported.at(-1)).toBe('ほん');
    });

    it('leaves a composition alone, and an IME\'s kana as it commits them', () => {
        const field = mount(true);
        fire(field, new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        input(field, 'k', 1, true);
        input(field, 'か', 1, true);
        expect(reported).toEqual(['k', 'か']);
        input(field, '食べ', 2, true);
        fire(field, new CompositionEvent('compositionend', { bubbles: true, data: '食べ' }));
        expect(field.value).toBe('食べ');
        type(field, 'ru');
        expect(field.value).toBe('食べる');
    });

    it('converts a composition a predictive keyboard ended in Latin letters', () => {
        const field = mount(true);
        fire(field, new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        input(field, 'tabe', 4, true);
        expect(field.value).toBe('tabe');
        fire(field, new CompositionEvent('compositionend', { bubbles: true, data: 'tabe' }));
        expect(field.value).toBe('たべ');
        expect(reported.at(-1)).toBe('たべ');
    });
});
