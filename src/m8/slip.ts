const END = 0xc0;
const ESC = 0xdb;
const ESC_END = 0xdc;
const ESC_ESC = 0xdd;

export class SlipDecoder {
	private buf: number[] = [];
	private escaped = false;

	constructor(private readonly onPacket: (packet: Uint8Array) => void) {}

	push(chunk: Uint8Array | Buffer): void {
		for (const byte of chunk) {
			if (this.escaped) {
				if (byte === ESC_END) this.buf.push(END);
				else if (byte === ESC_ESC) this.buf.push(ESC);
				else this.buf.push(byte);
				this.escaped = false;
				continue;
			}
			if (byte === END) {
				if (this.buf.length > 0) {
					this.onPacket(Uint8Array.from(this.buf));
					this.buf = [];
				}
				continue;
			}
			if (byte === ESC) {
				this.escaped = true;
				continue;
			}
			this.buf.push(byte);
		}
	}
}
