#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {M8Connection} from './m8/connection.js';
import {
	BUTTONS,
	type ButtonName,
	MAX_NOTE,
	MAX_VELOCITY,
} from './m8/protocol.js';

const BUTTON_NAMES = Object.keys(BUTTONS) as [ButtonName, ...ButtonName[]];
const MAX_REPEAT = 64;
// Many MCP clients abort a tool call after 60s (the MCP SDK default; the Claude
// desktop app too). At ~80ms per press this keeps a sequence around 41s.
const MAX_SEQUENCE_PRESSES = 512;
const MIN_DURATION_MS = 10;
// The tool call blocks while a key is held, so keep holds short.
const MAX_DURATION_MS = 5000;

function text(t: string) {
	return {content: [{type: 'text' as const, text: t}]};
}

// Both src/ (tsx) and dist/ (published build) sit right under the package root.
function readPackageInfo(): {name: string; version: string} {
	return JSON.parse(
		readFileSync(new URL('../package.json', import.meta.url), 'utf8')
	);
}

async function main(): Promise<void> {
	const m8 = new M8Connection();
	const {name, version} = readPackageInfo();
	const server = new McpServer({name, version});

	server.registerTool(
		'connect',
		{
			title: 'Connect to M8',
			description:
				'Open the USB serial connection to the M8. Other tools connect automatically, so this is only needed to reconnect explicitly or to check that the M8 is reachable.',
			inputSchema: {},
		},
		async () => {
			const already = m8.isConnected();
			await m8.open();
			return text(already ? 'Already connected.' : 'Connected.');
		}
	);

	server.registerTool(
		'disconnect',
		{
			title: 'Disconnect from M8',
			description:
				'Close the USB serial connection so other apps (m8c, TyUploader for firmware updates, etc.) can use the M8. The next M8 tool call reconnects automatically.',
			inputSchema: {},
		},
		async () => {
			if (!m8.isConnected()) return text('Already disconnected.');
			await m8.close();
			return text('Disconnected.');
		}
	);

	server.registerTool(
		'get_system_info',
		{
			title: 'Get M8 system info',
			description:
				'Returns hardware model, firmware version, and font mode of the connected M8.',
			inputSchema: {},
		},
		async () => {
			await m8.open();
			const info = m8.getSystemInfo();
			return text(
				info
					? `Hardware: ${info.hardware}\nFirmware: ${info.firmware}\nFont mode: ${info.fontMode}`
					: 'System info not received yet.'
			);
		}
	);

	server.registerTool(
		'get_screen',
		{
			title: 'Get M8 screen text',
			description:
				'Returns the current M8 screen as text with inline color tags. A Palette section maps slot letters to fg/bg colors. In the Screen section, "{x}" switches the color to slot x until the next tag; each line starts in slot "a". Spaces do not trigger tags. The Cursor section gives the line (1-based within the Screen section), the columns (1-based, not counting {x} tags) and the text inside the cursor frame.',
			inputSchema: {},
		},
		async () => {
			await m8.open();
			return text(m8.getScreen());
		}
	);

	server.registerTool(
		'press_buttons',
		{
			title: 'Press M8 buttons',
			description:
				'Press one or more M8 buttons simultaneously for a short duration (default 50ms), then release, optionally several times. Use arrays to combine modifier-style inputs; names match the M8 hardware labels. E.g. ["shift","right"] for SHIFT+RIGHT (move to the next screen), ["edit","up"] with repeat 3 to raise a hex value by 0x30.',
			inputSchema: {
				buttons: z
					.array(z.enum(BUTTON_NAMES))
					.min(1)
					.describe('Buttons to press simultaneously'),
				repeat: z.number().int().min(1).max(MAX_REPEAT).default(1),
				duration_ms: z
					.number()
					.int()
					.min(MIN_DURATION_MS)
					.max(MAX_DURATION_MS)
					.optional(),
			},
		},
		async ({buttons, repeat, duration_ms}) => {
			await m8.open();
			await m8.pressButtons(buttons, duration_ms, repeat);
			return text(
				`Pressed ${buttons.join('+')}${repeat > 1 ? ` x${repeat}` : ''}`
			);
		}
	);

	server.registerTool(
		'press_sequence',
		{
			title: 'Press a sequence of M8 buttons',
			description:
				'Run several button presses in order in one call, each like press_buttons (pressed together, released, optionally repeated). Use it for multi-step edits, e.g. setting the three RGB values of a theme row. The user may move the cursor on the device between calls, so read the screen right before running a sequence to confirm where the cursor is, and read it again afterwards to confirm the result.',
			inputSchema: {
				steps: z
					.array(
						z.object({
							buttons: z.array(z.enum(BUTTON_NAMES)).min(1),
							repeat: z.number().int().min(1).max(MAX_REPEAT).default(1),
						})
					)
					.min(1),
			},
		},
		async ({steps}) => {
			const total = steps.reduce((n, s) => n + s.repeat, 0);
			if (total > MAX_SEQUENCE_PRESSES) {
				throw new Error(
					`Sequence has ${total} presses; the limit is ${MAX_SEQUENCE_PRESSES}. Split it into smaller calls.`
				);
			}
			await m8.open();
			for (const s of steps)
				await m8.pressButtons(s.buttons, undefined, s.repeat);
			return text(`Ran ${steps.length} steps (${total} presses).`);
		}
	);

	server.registerTool(
		'press_note',
		{
			title: 'Press a note key (keyjazz)',
			description:
				'Press a note key as if on a keyboard for duration_ms, then release it. The M8 uses the current instrument (the instrument number last set in a phrase), not the instrument on the cursor row. On the PHRASE screen with the cursor on the note column, this enters the note and the current instrument into that row; elsewhere it only plays the note. Move the cursor off the note column to only listen. Note numbers: 36 is C-4, 48 is C-5.',
			inputSchema: {
				note: z.number().int().min(0).max(MAX_NOTE),
				velocity: z.number().int().min(0).max(MAX_VELOCITY).default(100),
				duration_ms: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS),
			},
		},
		async ({note, velocity, duration_ms}) => {
			await m8.open();
			await m8.pressNote(note, velocity, duration_ms);
			return text(
				`Pressed note ${note} (vel ${velocity}) for ${duration_ms}ms`
			);
		}
	);

	const shutdown = async (): Promise<void> => {
		await m8.close();
		process.exit(0);
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);

	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
