// Reference: laamaa/m8c (MIT) — src/input.h, src/command.c, src/backends/m8_libserialport.c

// Names follow the M8 hardware labels. m8c calls PLAY "start", SHIFT "select" and OPTION "opt".
export const BUTTONS = {
	edit: 1 << 0,
	option: 1 << 1,
	right: 1 << 2,
	play: 1 << 3,
	shift: 1 << 4,
	down: 1 << 5,
	up: 1 << 6,
	left: 1 << 7,
} as const;

export type ButtonName = keyof typeof BUTTONS;

export const NO_BUTTONS = 0;

export function buttonsToMask(buttons: readonly ButtonName[]): number {
	let mask = NO_BUTTONS;
	for (const b of buttons) mask |= BUTTONS[b];
	return mask;
}

export const SEND_ENABLE_DISPLAY = 'E'.charCodeAt(0);
export const SEND_RESET_DISPLAY = 'R'.charCodeAt(0);
export const SEND_DISCONNECT = 'D'.charCodeAt(0);
export const SEND_CONTROLLER = 'C'.charCodeAt(0);
export const SEND_KEYJAZZ = 'K'.charCodeAt(0);

export const KEYJAZZ_NOTE_OFF = 0xff;
export const MAX_NOTE = 127;
export const MAX_VELOCITY = 127;

const RECV_SYSTEM_INFO = 0xff;
const RECV_DRAW_RECT = 0xfe;
const RECV_DRAW_CHAR = 0xfd;

const SYSTEM_INFO_LENGTH = 6;
const DRAW_CHAR_LENGTH = 12;
// Draw-rect packets drop trailing fields: a missing size means 1x1 and a
// missing color means the last color drawn.
const DRAW_RECT_LENGTH = {
	pos: 5,
	posColor: 8,
	posSize: 9,
	posSizeColor: 12,
} as const;

export type RGB = readonly [number, number, number];

export const BLACK: RGB = [0, 0, 0];

export interface SystemInfo {
	hardware: string;
	firmware: string;
	fontMode: number;
}

export interface DrawChar {
	code: number;
	x: number;
	y: number;
	fg: RGB;
	bg: RGB;
}

export interface DrawRect {
	x: number;
	y: number;
	w: number;
	h: number;
	color: RGB;
}

const HW_TYPES = [
	'Headless',
	'Beta M8',
	'Production M8',
	'Production M8 Model:02',
];

function readU16(packet: Uint8Array, offset: number): number {
	return packet[offset] | (packet[offset + 1] << 8);
}

function readRGB(packet: Uint8Array, offset: number): RGB {
	return [packet[offset], packet[offset + 1], packet[offset + 2]];
}

export function decodeSystemInfo(packet: Uint8Array): SystemInfo | null {
	if (packet[0] !== RECV_SYSTEM_INFO || packet.length !== SYSTEM_INFO_LENGTH) {
		return null;
	}
	return {
		hardware: HW_TYPES[packet[1]] ?? `Unknown(${packet[1]})`,
		firmware: `${packet[2]}.${packet[3]}.${packet[4]}`,
		fontMode: packet[5],
	};
}

export function decodeDrawChar(packet: Uint8Array): DrawChar | null {
	if (packet[0] !== RECV_DRAW_CHAR || packet.length !== DRAW_CHAR_LENGTH) {
		return null;
	}
	return {
		code: packet[1],
		x: readU16(packet, 2),
		y: readU16(packet, 4),
		fg: readRGB(packet, 6),
		bg: readRGB(packet, 9),
	};
}

export function decodeDrawRect(
	packet: Uint8Array,
	lastColor: RGB
): DrawRect | null {
	if (packet[0] !== RECV_DRAW_RECT) return null;
	const x = readU16(packet, 1);
	const y = readU16(packet, 3);
	switch (packet.length) {
		case DRAW_RECT_LENGTH.pos:
			return {x, y, w: 1, h: 1, color: lastColor};
		case DRAW_RECT_LENGTH.posColor:
			return {x, y, w: 1, h: 1, color: readRGB(packet, 5)};
		case DRAW_RECT_LENGTH.posSize:
			return {
				x,
				y,
				w: readU16(packet, 5),
				h: readU16(packet, 7),
				color: lastColor,
			};
		case DRAW_RECT_LENGTH.posSizeColor:
			return {
				x,
				y,
				w: readU16(packet, 5),
				h: readU16(packet, 7),
				color: readRGB(packet, 9),
			};
		default:
			return null;
	}
}
