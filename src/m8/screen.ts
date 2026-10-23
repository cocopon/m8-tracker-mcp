// Collects draw_character packets and reconstructs the M8 screen as text,
// with a compact palette-indexed color encoding.

import type {Bounds} from './cursor.js';
import type {DrawChar, RGB} from './protocol.js';

const CHAR_W = 8;
const CHAR_H = 10;
const SPACE = ' '.charCodeAt(0);

function hex2(n: number): string {
	return n.toString(16).padStart(2, '0');
}

function rgbHex(c: RGB): string {
	return `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
}

function colorKey(fg: RGB, bg: RGB): string {
	return `${rgbHex(fg)}/${rgbHex(bg)}`;
}

const SLOTS = [
	...'abcdefghijklmnopqrstuvwxyz',
	...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
];

function slotForIndex(i: number): string {
	if (i < SLOTS.length) return SLOTS[i];
	const first = SLOTS[Math.floor(i / SLOTS.length) - 1];
	const second = SLOTS[i % SLOTS.length];
	return `${first}${second}`;
}

export interface RenderedScreen {
	palette: string;
	screen: string;
	cursor: string; // '' if no cursor frame was found
}

export function renderScreen(
	chars: DrawChar[],
	cursorBounds: Bounds | null = null
): RenderedScreen {
	if (chars.length === 0) return {palette: '', screen: '', cursor: ''};

	const counts = new Map<string, {fg: RGB; bg: RGB; count: number}>();
	for (const c of chars) {
		const key = colorKey(c.fg, c.bg);
		const entry = counts.get(key);
		if (entry) entry.count++;
		else counts.set(key, {fg: c.fg, bg: c.bg, count: 1});
	}
	const paletteEntries = [...counts.values()].sort((a, b) => b.count - a.count);
	const keyToSlot = new Map<string, string>();
	paletteEntries.forEach((e, i) => {
		keyToSlot.set(colorKey(e.fg, e.bg), slotForIndex(i));
	});

	const paletteLines = paletteEntries.map(
		(e, i) => `${slotForIndex(i)} fg=${rgbHex(e.fg)} bg=${rgbHex(e.bg)}`
	);

	const rows = new Map<number, DrawChar[]>();
	for (const c of chars) {
		const row = Math.round(c.y / CHAR_H);
		const arr = rows.get(row) ?? [];
		arr.push(c);
		rows.set(row, arr);
	}

	// Lines start in the most frequent color, so the commonest text needs no tag.
	const baseSlot = slotForIndex(0);
	const sortedRows = [...rows.entries()].sort(([a], [b]) => a - b);
	const sortedRowKeys = sortedRows.map(([key]) => key);
	const screenLines: string[] = [];
	for (const [, rowChars] of sortedRows) {
		const row = rowChars.slice().sort((a, b) => a.x - b.x);
		let line = '';
		let lastCol = -1;
		let currentSlot = baseSlot;
		for (const c of row) {
			const col = Math.round(c.x / CHAR_W);
			if (col > lastCol + 1) line += ' '.repeat(col - lastCol - 1);
			const slot = keyToSlot.get(colorKey(c.fg, c.bg)) ?? baseSlot;
			const isSpace = c.code === SPACE;
			// Spaces are visually color-neutral, so keep the current slot across them
			// to cut down on tag noise. Non-space chars drive slot changes.
			if (!isSpace && slot !== currentSlot) {
				line += `{${slot}}`;
				currentSlot = slot;
			}
			line += String.fromCharCode(c.code);
			lastCol = col;
		}
		screenLines.push(line);
	}

	return {
		palette: paletteLines.join('\n'),
		screen: screenLines.join('\n'),
		cursor: describeCursor(chars, cursorBounds, sortedRowKeys),
	};
}

function describeCursor(
	chars: DrawChar[],
	b: Bounds | null,
	sortedRowKeys: number[]
): string {
	if (!b) return '';
	// The frame pads 4px on the left, enough to reach the center of the previous
	// cell, so test cell edges horizontally. Allow 1px because the blinking frame
	// alternates with a copy inset by 1px.
	const inside = chars
		.filter((c) => {
			const cy = c.y + CHAR_H / 2;
			return (
				c.x >= b.x0 - 1 && c.x + CHAR_W <= b.x1 + 1 && cy >= b.y0 && cy <= b.y1
			);
		})
		.sort((a, c) => a.y - c.y || a.x - c.x);
	if (inside.length === 0) return '';
	const first = inside[0];
	const last = inside[inside.length - 1];
	const line = sortedRowKeys.indexOf(Math.round(first.y / CHAR_H)) + 1;
	const col0 = Math.round(first.x / CHAR_W) + 1;
	const col1 = Math.round(last.x / CHAR_W) + 1;
	const text = inside.map((c) => String.fromCharCode(c.code)).join('');
	return `line ${line}, columns ${col0}-${col1}: "${text}"`;
}

export function formatScreenForDisplay(rs: RenderedScreen): string {
	if (!rs.screen) return '(empty)';
	const cursor = rs.cursor || '(not found)';
	return `=== Palette ===\n${rs.palette}\n\n=== Screen ===\n${rs.screen}\n\n=== Cursor ===\n${cursor}`;
}
