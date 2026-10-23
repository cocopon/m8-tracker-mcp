import assert from 'node:assert/strict';
import {describe, it} from 'mocha';
import {buttonsToMask, decodeDrawRect, type RGB} from './protocol.js';

describe(buttonsToMask.name, () => {
	it('should combine buttons into one mask', () => {
		assert.equal(buttonsToMask(['shift', 'right']), 0x10 | 0x04);
	});
});

describe(decodeDrawRect.name, () => {
	it('should default to 1x1 when a rect carries a position and color only', () => {
		const lastColor: RGB = [9, 9, 9];
		const packet = Uint8Array.of(0xfe, 1, 0, 2, 0, 7, 8, 9);
		assert.deepEqual(decodeDrawRect(packet, lastColor), {
			x: 1,
			y: 2,
			w: 1,
			h: 1,
			color: [7, 8, 9],
		});
	});
});
