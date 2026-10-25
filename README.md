# wtf hub

Desktop project hub for `Documents/Projects`: browse local repos, open an in-app terminal, and launch AI CLIs in that terminal.

Hyprland-inspired tiling UI with a waybar-style top strip, bordered tiles, and an accent focus ring.

**GitHub:** https://github.com/revo667/wtf-hub

## Features

- Scan a configurable projects root (default `~/Documents/Projects`)
- Project sidebar with git / npm / readme tags and filter
- Embedded terminal tabs via `node-pty` + xterm.js
- Notepad++-style multi-tab editor (CodeMirror) with line numbers, open/save, and language modes
- Bottom-right music control linked to **your** Spotify / SoundCloud accounts (OAuth)
- AI CLI launcher logos for Claude, Antigravity, and Cursor Agent when present on `PATH`
- Open project in file manager or VS Code / Cursor editor
- Settings for projects root and default shell

## Requirements

- Node.js 20+
- Linux/macOS recommended for PTY
- Build tools for `node-pty` native module (Python, make, a C++ toolchain)

## Setup

```bash
git clone https://github.com/revo667/wtf-hub.git
cd wtf-hub
npm install
npm start              # Electron + Vite + real PTY
```

Browser-only UI (with local PTY bridge):

```bash
npm run dev            # http://127.0.0.1:43127
```

## Scripts

```bash
npm install
npm run dev             # Vite UI + local PTY bridge
npm run electron:dev    # Electron + Vite + PTY (full features)
npm run electron:attach # Electron only, reuse Vite already on :43127
npm start               # alias for electron:dev
npm run build           # Production renderer + electron bundles
```

`npm run dev` starts a bridge on `ws://127.0.0.1:43126` so terminals are real shells. Install `claude` / `antigravity` / `cursor-agent` on your `PATH` so they show as available.

## Usage

1. Run `npm start`
2. Empty desktop binds:
   - `A` projects · `W` terminal · `E` editor · `M` Spotify · `P` music · `S` AI CLIs · `D` widgets · `Q` close
3. Editor: `Ctrl/Cmd+S` save, `Ctrl/Cmd+Shift+S` save as, `Ctrl/Cmd+O` open, `Ctrl/Cmd+N` new tab
4. While typing in terminal/editor, hold **Super** or **Alt** with window binds
5. Set **Projects root** from widgets → Settings

Without Electron/bridge the UI falls back to a demo mock (`demo · no pty`).

## Music accounts (Electron)

1. **Spotify** — [developer.spotify.com](https://developer.spotify.com/dashboard)
   - Redirect URI `http://127.0.0.1:43128/callback`
   - Client ID in Hub Settings → Connect Spotify
2. **SoundCloud** — Client ID + Secret in Settings
   - Redirect URI `http://127.0.0.1:43129/callback`

Tokens stay in local `music-auth.json` under Electron userData.

## Discord Rich Presence (Electron)

1. Create an application at [discord.com/developers](https://discord.com/developers/applications)
2. Copy the **Application ID** into Hub Settings → Discord
3. Under Rich Presence → Art Assets, upload `assets/discord-rich-presence-512.png` (key becomes `discord-rich-presence-512` unless you rename it)
4. Enable Rich Presence in Settings and keep the Discord desktop app running

Presence lines:
- **Details** — `Working on <project>` (or `Browsing projects`)
- **State** — open surfaces, e.g. `Terminal · Code editor`

## Notes

- CLI buttons stay disabled when the binary is missing from `PATH`
- Settings live in `hub-settings.json` under the app userData folder
