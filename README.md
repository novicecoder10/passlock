# PassLock

A cross-platform desktop password manager built with Electron. Everything lives
in a single AES-256-GCM encrypted file on your own machine — there is no cloud,
no account, and no sync server.

Beyond storing website logins, PassLock stores SSH connections (including
multi-hop ProxyJump chains) and opens them in a real terminal window with one
click, and exposes a local, token-authenticated HTTP API that a browser
extension can use to autofill credentials.

## Features

- **Encrypted local vault** — AES-256-GCM with a PBKDF2-SHA256 key
  (100,000 iterations), a fresh random salt and IV on every write, and an
  authentication tag verified on read.
- **Master password only** — the key is derived on unlock and never written to
  disk; locking wipes the decrypted vault from memory.
- **SSH launcher** — store host, port, user, key path and extra `ssh` options,
  then launch a session in your terminal. Multiple jump hosts are chained into a
  single `-J` argument.
- **Terminal auto-detection** — gnome-terminal, konsole, xfce4-terminal, kitty,
  alacritty or xterm on Linux; Terminal.app via AppleScript on macOS;
  `cmd.exe` on Windows.
- **Browser autofill API** — a loopback-only HTTP server on port `19842` serves
  domain-matched logins to a browser extension, guarded by a per-vault bearer
  token you can regenerate at any time.
- **Clipboard auto-clear** — copied passwords are wiped after 30 seconds, and
  only if you haven't copied something else since.
- **Hardened renderer** — context isolation on, node integration off, sandboxed
  renderer; all privileged work happens in the main process over IPC.

## Requirements

- Node.js 18+
- An `ssh` client on `PATH` (only needed for SSH entries)
- Optional: `sshpass`, for SSH entries that use a stored password instead of a key

## Install

```bash
git clone https://github.com/novicecoder10/passlock.git
cd passlock
npm install
npm start
```

`npm run dev` is the same thing; both pass `--disable-gpu`, which avoids
rendering glitches on some Linux setups.

## Usage

On first launch you choose a master password. This creates the vault at
`~/.config/passlock/db.enc` and generates the API token used by the browser
extension. **There is no recovery path — if you forget the master password, the
vault cannot be decrypted.**

Entries come in two kinds:

| Type | Stores | Action |
| --- | --- | --- |
| Website | URL, username, password | Copy credentials, open the site, autofill via the extension |
| SSH | host, port, user, key path, jump hosts, extra options | Open an SSH session in a terminal |

Click an entry to reveal its details; use the copy buttons rather than
selecting text, so the clipboard auto-clear applies.

## Local API

The HTTP server binds to `127.0.0.1:19842` and runs only while the app is open.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/status` | none | Returns `{ "locked": bool }` |
| `GET` | `/logins?domain=<host>` | Bearer token | Returns website logins matching the domain |

Requests are rejected with `401 vault_locked` while the vault is locked, and
`403 unauthorized` if the bearer token is missing or wrong. Copy the token from
the app's settings; regenerating it invalidates the old one immediately.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:19842/logins?domain=github.com"
```

## Vault format

The file at `~/.config/passlock/db.enc` is JSON holding only ciphertext and the
parameters needed to decrypt it:

```json
{ "salt": "<hex>", "iv": "<hex>", "authTag": "<hex>", "ciphertext": "<hex>" }
```

Decrypted, it is `{ "version": 1, "apiToken": "<hex>", "logins": [...] }`.
Back up the encrypted file directly — it is portable between machines.

## Project layout

| File | Role |
| --- | --- |
| `main.js` | Electron main process, window lifecycle, IPC handlers, clipboard |
| `preload.js` | Context-isolated bridge exposing `window.api` to the renderer |
| `db-manager.js` | Encryption, vault I/O, CRUD, API token management |
| `ssh-launcher.js` | SSH command construction and terminal spawning |
| `server.js` | Loopback HTTP API for browser-extension autofill |
| `renderer.js` / `index.html` / `index.css` | UI |
| `test-crypto.js` / `test-main.js` | Encryption round-trip and startup checks |

## Tests

```bash
npm test          # encryption round-trip
node test-main.js # module load / startup check
```

## Security notes

- The vault is only as strong as the master password — PBKDF2 slows brute force
  but does not fix a weak passphrase.
- While the vault is unlocked, decrypted entries are held in the main process's
  memory, and any local process holding the API token can read website logins.
- SSH passwords are passed to `sshpass` through an environment variable rather
  than the command line, so they don't appear in the process list — but key-based
  authentication is still the better option.
- This is a personal project, not an audited product. Review the code before
  trusting it with anything critical.

## License

[MIT](LICENSE)
