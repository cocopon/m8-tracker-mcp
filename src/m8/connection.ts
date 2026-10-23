import {SerialPort} from 'serialport';
import {M8Display} from './display.js';
import {
	type ButtonName,
	buttonsToMask,
	KEYJAZZ_NOTE_OFF,
	NO_BUTTONS,
	SEND_CONTROLLER,
	SEND_DISCONNECT,
	SEND_ENABLE_DISPLAY,
	SEND_KEYJAZZ,
	SEND_RESET_DISPLAY,
	type SystemInfo,
} from './protocol.js';

const M8_VID = '16c0';
const M8_PIDS = new Set(['048a', '048b']);
const BAUD_RATE = 115200;
// Keep pulses well under the M8 key-repeat delay (150ms by default) so a press never auto-repeats.
const DEFAULT_PULSE_MS = 50;
const GAP_MS = 30;
const DISPLAY_WARMUP_MS = 500;
// Give the redraw time to arrive so the first screen read is not empty.
const FIRST_REDRAW_MS = 300;

async function findM8Path(): Promise<string> {
	const ports = await SerialPort.list();
	const found = ports.find(
		(p) =>
			p.vendorId?.toLowerCase() === M8_VID &&
			p.productId &&
			M8_PIDS.has(p.productId.toLowerCase())
	);
	if (!found) throw new Error('M8 not found (VID=16C0, PID=048A/048B)');
	return found.path;
}

export const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export async function openM8Port(): Promise<SerialPort> {
	const path = await findM8Path();
	const port = new SerialPort({path, baudRate: BAUD_RATE, autoOpen: false});
	await new Promise<void>((resolve, reject) => {
		port.open((err) => {
			if (!err) return resolve();
			if (/lock|busy/i.test(err.message)) {
				return reject(
					new Error(
						`M8 at ${path} is in use by another app (another m8-tracker-mcp instance, m8c, TyUploader, etc.). Close it and try again. (${err.message})`
					)
				);
			}
			reject(err);
		});
	});
	return port;
}

// Asks the M8 to stream its display and redraw everything from scratch.
export async function enableDisplay(port: SerialPort): Promise<void> {
	port.write(Buffer.from([SEND_ENABLE_DISPLAY]));
	await sleep(DISPLAY_WARMUP_MS);
	port.write(Buffer.from([SEND_RESET_DISPLAY]));
	await sleep(FIRST_REDRAW_MS);
}

export async function closeM8Port(port: SerialPort): Promise<void> {
	if (!port.isOpen) return;
	await new Promise<void>((resolve) => {
		port.write(Buffer.from([SEND_DISCONNECT]), () =>
			port.close(() => resolve())
		);
	});
}

export class M8Connection {
	private port: SerialPort | null = null;
	private opening: Promise<void> | null = null;
	private display = new M8Display();

	isConnected(): boolean {
		return this.port !== null;
	}

	// Safe to call before every operation; concurrent callers share one open attempt.
	async open(): Promise<void> {
		if (this.port) return;
		if (!this.opening) {
			this.opening = this.doOpen().finally(() => {
				this.opening = null;
			});
		}
		return this.opening;
	}

	private async doOpen(): Promise<void> {
		const port = await openM8Port();

		// Start from a fresh display so stale screen data from a previous session never leaks through.
		const display = new M8Display();
		this.display = display;
		port.on('data', (chunk: Buffer) => display.push(chunk));
		// Fires on unplug as well as on our own close.
		port.on('close', () => {
			if (this.port === port) this.port = null;
		});
		port.on('error', (err) => console.error('M8 serial error:', err));
		this.port = port;
		await enableDisplay(port);
	}

	async close(): Promise<void> {
		await this.opening?.catch(() => {});
		const port = this.port;
		if (!port) return;
		this.port = null;
		await closeM8Port(port);
	}

	private writeBytes(bytes: readonly number[]): void {
		if (!this.port) throw new Error('M8 not connected');
		this.port.write(Buffer.from(bytes));
	}

	async pressButtons(
		buttons: readonly ButtonName[],
		durationMs: number = DEFAULT_PULSE_MS,
		repeat = 1
	): Promise<void> {
		const mask = buttonsToMask(buttons);
		for (let i = 0; i < repeat; i++) {
			this.writeBytes([SEND_CONTROLLER, mask]);
			await sleep(durationMs);
			this.writeBytes([SEND_CONTROLLER, NO_BUTTONS]);
			// Always wait after releasing: without a gap the M8 never sees the release,
			// so a following press reads as a held combo changing instead of a new press.
			await sleep(GAP_MS);
		}
	}

	async pressNote(
		note: number,
		velocity: number,
		durationMs: number
	): Promise<void> {
		this.writeBytes([SEND_KEYJAZZ, note, velocity]);
		await sleep(durationMs);
		this.writeBytes([SEND_KEYJAZZ, KEYJAZZ_NOTE_OFF]);
	}

	getSystemInfo(): SystemInfo | null {
		return this.display.getSystemInfo();
	}

	getScreen(): string {
		return this.display.getScreen();
	}
}
