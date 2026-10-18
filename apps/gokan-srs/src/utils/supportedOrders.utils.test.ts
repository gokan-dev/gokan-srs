import { describe, it, expect } from 'vitest';
import { supportedOrdersList } from './supportedOrders.utils';

describe('supportedOrdersList', () => {
    it('names every order once, the most followed first', () => {
        expect(supportedOrdersList()).toBe(
            'KKLC, Remembering the Kanji (any edition), JLPT and frequency order, the school-grade order, '
            + 'Kanji in Context, Henshall, the White Rabbit and Tuttle cards, and Les Kanjis dans la tête',
        );
    });
});
