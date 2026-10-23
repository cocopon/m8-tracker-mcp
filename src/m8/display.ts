import {CursorTracker} from './cursor.js';
import {
	BLACK,
	type DrawChar,
	decodeDrawChar,
	decodeDrawRect,
	decodeSystemInfo,
	type RGB,
	type SystemInfo,
} from './protocol.js';
import {formatScreenForDisplay, renderScreen} from './screen.js';
import {SlipDecoder} from './slip.js';

// Mirrors the M8 display from the raw serial stream, independent of the port itself.
export class M8Display {
	private decoder = new SlipDecoder((packet) => this.handlePacket(packet));
	private chars = new Map<string, DrawChar>();
	private cursor = new CursorTracker();
	private lastRectColor: RGB = BLACK;
	private systemInfo: SystemInfo | null = null;

	push(chunk: Uint8Array): void {
		this.decoder.push(chunk);
	}

	getSystemInfo(): SystemInfo | null {
		return this.systemInfo;
	}

	getScreen(): string {
		return formatScreenForDisplay(
			renderScreen([...this.chars.values()], this.cursor.bounds())
		);
	}

	private handlePacket(packet: Uint8Array): void {
		const info = decodeSystemInfo(packet);
		if (info) {
			this.systemInfo = info;
			return;
		}
		const dc = decodeDrawChar(packet);
		if (dc) {
			this.chars.set(`${dc.x},${dc.y}`, dc);
			return;
		}
		const rect = decodeDrawRect(packet, this.lastRectColor);
		if (rect) {
			this.lastRectColor = rect.color;
			this.cursor.apply(rect);
		}
	}
}
