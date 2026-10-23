import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'mocha';
import {M8Display} from './display.js';

// Raw serial streams recorded from a Production M8 (Model:01) on firmware 6.6.3
// with `npm run capture`. Each .txt was checked against the device's own screen.
const FIXTURES = ['song', 'project-name'];

// Serial reads arrive in arbitrary pieces; an odd size splits SLIP frames mid-way.
const CHUNK_SIZE = 61;

function readFixture(file: string): Buffer {
	return readFileSync(new URL(`../../fixtures/${file}`, import.meta.url));
}

function replay(bytes: Buffer): M8Display {
	const display = new M8Display();
	for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
		display.push(bytes.subarray(i, i + CHUNK_SIZE));
	}
	return display;
}

describe(M8Display.name, () => {
	for (const name of FIXTURES) {
		it(`should render the recorded ${name} screen as the device showed it`, () => {
			const display = replay(readFixture(`${name}.bin`));
			assert.equal(
				`${display.getScreen()}\n`,
				readFixture(`${name}.txt`).toString('utf8')
			);
		});
	}

	it('should read system info from the recorded stream', () => {
		const display = replay(readFixture('song.bin'));
		assert.deepEqual(display.getSystemInfo(), {
			hardware: 'Production M8',
			firmware: '6.6.3',
			fontMode: 0,
		});
	});
});
