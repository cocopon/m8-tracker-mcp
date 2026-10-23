import assert from 'node:assert/strict';
import {describe, it} from 'mocha';
import {SlipDecoder} from './slip.js';

describe(SlipDecoder.name, () => {
	it('should restore an escaped ESC byte', () => {
		const packets: number[][] = [];
		const decoder = new SlipDecoder((p) => packets.push([...p]));
		decoder.push(Uint8Array.of(1, 0xdb, 0xdd, 2, 0xc0));
		assert.deepEqual(packets, [[1, 0xdb, 2]]);
	});
});
