# m8-tracker-mcp
Unofficial [MCP](https://modelcontextprotocol.io) server for controlling a [Dirtywave M8](https://dirtywave.com) over USB.

https://github.com/user-attachments/assets/da976470-4959-4849-9671-ee1f7610f04a


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


## Screen format
`get_screen` returns the palette, the screen, and the cursor position:

```
=== Palette ===
a fg=#787c90 bg=#303440
b fg=#404050 bg=#303440
c fg=#f0f0f0 bg=#303440
d fg=#b0b0c0 bg=#303440
e fg=#98fcf8 bg=#303440
f fg=#00fcf8 bg=#303440

=== Screen ===
                                        
                                        
 {e}SONG                                   
                                        
    1  2  3  4  5  6  {f}7  {a}8        T>120 
 00 {b}-- -- -- -- -- -- -- --             
 01 {b}-- -- -- -- -- -- -- --       {a}1 {b}--- 
 02 {b}-- -- -- -- -- -- -- --       {a}2 {b}--- 
 03 {b}-- -- -- -- -- -- -- --       {a}3 {b}--- 
 04 {b}-- -- -- -- -- -- -- --       {a}4 {b}--- 
 05 {b}-- -- -- -- -- -- -- --       {a}5 {b}--- 
 06 {b}-- -- -- -- -- -- -- --       {a}6 {b}--- 
 07 {b}-- -- -- -- -- -- -- --       {f}7 {b}--- 
 {f}08 {b}-- -- -- -- -- -- {f}-- {b}--       {a}8 {b}--- 
 09 {b}-- -- -- -- -- -- -- --             
 0A {b}-- -- -- -- -- -- -- --             
 0B {b}-- -- -- -- -- -- -- --             
 0C {b}-- -- -- -- -- -- -- --             
 0D {b}-- -- -- -- -- -- -- --       {a}P     
 0E {b}-- -- -- -- -- -- -- --       {f}S{a}CPIT 
 0F {b}-- -- -- -- -- -- -- --       {a}V     
                                        
                                        

=== Cursor ===
line 14, columns 23-24: "--"
```


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
