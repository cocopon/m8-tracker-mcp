// Records the raw serial stream from a connected M8 as a test fixture, along with
// the screen text it renders to. Check the text against the device before committing:
// that comparison is what makes the fixture trustworthy.
//
// Usage: npm run capture -- <name>

import {writeFileSync} from 'node:fs';
import {
	closeM8Port,
	enableDisplay,
	openM8Port,
	sleep,
} from '../src/m8/connection.js';
import {M8Display} from '../src/m8/display.js';

// Long enough to include several frames of the blinking cursor animation.
const EXTRA_CAPTURE_MS = 1000;

const name = process.argv[2];
if (!name) {
	console.error('Usage: npm run capture -- <name>');
	process.exit(1);
}

const port = await openM8Port();
const chunks: Buffer[] = [];
port.on('data', (chunk: Buffer) => chunks.push(chunk));
await enableDisplay(port);
await sleep(EXTRA_CAPTURE_MS);
await closeM8Port(port);

const bytes = Buffer.concat(chunks);
const display = new M8Display();
display.push(bytes);
const screen = display.getScreen();

const dir = new URL('../fixtures/', import.meta.url);
writeFileSync(new URL(`${name}.bin`, dir), bytes);
writeFileSync(new URL(`${name}.txt`, dir), `${screen}\n`);

console.log(display.getSystemInfo());
console.log(screen);
console.log(
	`\nSaved fixtures/${name}.bin (${bytes.length} bytes) and fixtures/${name}.txt`
);
