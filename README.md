# m8-tracker-mcp

Unofficial [MCP](https://modelcontextprotocol.io) server for controlling a [Dirtywave M8](https://dirtywave.com) over USB.

It reads the M8 screen as text, presses buttons, and plays notes.

## Requirements

- Node.js 20 or later
- M8 connected over USB

Tested with M8 Model:01 on firmware 6.6.3 (macOS). Cursor detection assumes firmware 6.x.

Only one app can open the M8's serial port at a time. Close m8c or other clients, or call `disconnect` first.

## Tools

| Tool | Description |
| --- | --- |
| `get_screen` | Read the screen as text |
| `press_buttons` | Press buttons |
| `press_sequence` | Press a series of buttons |
| `press_note` | Press a note key (keyjazz) |
| `get_system_info` | Get the model and firmware version |
| `connect` / `disconnect` | Open or release the serial port |

Button names follow the M8 labels: `up`, `down`, `left`, `right`, `shift`, `play`, `option`, `edit`.

## Screen format

`get_screen` returns the palette, the screen, and the cursor position:

```
=== Palette ===
a fg=#787c90 bg=#303440
b fg=#404050 bg=#303440
...

=== Screen ===
 {e}SONG
...
 00 {b}-- -- -- -- -- -- -- --
...

=== Cursor ===
line 14, columns 23-24: "--"
```

`{x}` switches to palette slot `x`, and each line starts with slot `a`. Cursor columns don't count the tags.

## Development

```sh
npm install
npm run dev
npm run build
npm test
```

Tests replay serial data recorded from a real M8 in `fixtures/`. To record a new one, run `npm run capture -- <name>` and check `<name>.txt` against the device.

## Acknowledgments

Serial protocol handling was implemented with reference to [m8c](https://github.com/laamaa/m8c) by Jonne Kokkonen.

## License

MIT License. See `LICENSE` for more information.
