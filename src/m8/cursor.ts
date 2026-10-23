// Tracks the cursor frame. Since firmware 6.x the cursor is an animated outline drawn
// as tiny draw_rect corner pieces (3x1, 1x2, 1x1), erased by redrawing them in the
// background color.

import {BLACK, type DrawRect, type RGB} from './protocol.js';

export interface Bounds {
	x0: number;
	y0: number;
	x1: number; // inclusive
	y1: number; // inclusive
}

const MAX_PIECE = 3;
const SCREEN_WIDTH = 320;
// Each frame corner is an L of 6 connected pixels (3x1 + 1x2 + 1x1). Other UI
// ornaments also use tiny rects, so only corner-sized clusters count.
const CORNER_MIN = 5;
const CORNER_MAX = 8;

// Packs (x, y) into one number for Set lookups; any stride wider than the screen works.
const KEY_STRIDE = 4096;
const NEIGHBOR_OFFSETS = [
	-KEY_STRIDE - 1,
	-KEY_STRIDE,
	-KEY_STRIDE + 1,
	-1,
	1,
	KEY_STRIDE - 1,
	KEY_STRIDE,
	KEY_STRIDE + 1,
];

function toKey(x: number, y: number): number {
	return y * KEY_STRIDE + x;
}

function keyX(key: number): number {
	return key % KEY_STRIDE;
}

function keyY(key: number): number {
	return Math.floor(key / KEY_STRIDE);
}

function sameColor(a: RGB, b: RGB): boolean {
	return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export class CursorTracker {
	private pixels = new Set<number>();
	private background: RGB = BLACK;

	apply(r: DrawRect): void {
		if (r.w >= SCREEN_WIDTH) {
			// Full-width rects clear the screen; their color is the background.
			this.background = r.color;
		}
		const isPiece = r.w <= MAX_PIECE && r.h <= MAX_PIECE;
		if (isPiece && !sameColor(r.color, this.background)) {
			for (let y = r.y; y < r.y + r.h; y++) {
				for (let x = r.x; x < r.x + r.w; x++) this.pixels.add(toKey(x, y));
			}
			return;
		}
		// Anything else painted over the area hides frame pixels underneath.
		for (const k of this.pixels) {
			const x = keyX(k);
			const y = keyY(k);
			if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
				this.pixels.delete(k);
		}
	}

	bounds(): Bounds | null {
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		for (const cluster of this.clusters()) {
			if (cluster.length < CORNER_MIN || cluster.length > CORNER_MAX) continue;
			for (const k of cluster) {
				x0 = Math.min(x0, keyX(k));
				y0 = Math.min(y0, keyY(k));
				x1 = Math.max(x1, keyX(k));
				y1 = Math.max(y1, keyY(k));
			}
		}
		return x1 < 0 ? null : {x0, y0, x1, y1};
	}

	private clusters(): number[][] {
		const seen = new Set<number>();
		const result: number[][] = [];
		for (const start of this.pixels) {
			if (seen.has(start)) continue;
			seen.add(start);
			const cluster: number[] = [];
			const stack = [start];
			for (let k = stack.pop(); k !== undefined; k = stack.pop()) {
				cluster.push(k);
				for (const d of NEIGHBOR_OFFSETS) {
					const n = k + d;
					if (this.pixels.has(n) && !seen.has(n)) {
						seen.add(n);
						stack.push(n);
					}
				}
			}
			result.push(cluster);
		}
		return result;
	}
}
