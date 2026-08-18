# Development

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- Tauri v2 system dependencies ([see Tauri docs](https://v2.tauri.app/start/prerequisites/))

## Setting up on another machine

```bash
git clone https://github.com/Seemops1337/maish.git
cd maish
npm install
npm run tauri build -- --no-bundle
```

On macOS the system dependency is the Xcode command line tools, and Homebrew's
`rustup` is keg-only — its shims are not linked into `/opt/homebrew/bin`, so the
toolchain stays invisible until the directory is on `PATH`:

```bash
brew install rustup
echo 'export PATH="/opt/homebrew/opt/rustup/bin:$PATH"' >> ~/.zshrc
rustup default stable
```

Everything needed to build is in the repository — `package-lock.json` pins the
frontend dependencies and `src-tauri/Cargo.lock` the Rust ones. The first Rust
build takes several minutes; later ones are far quicker.

Your mail is **not** in the repository, and must not be. Two files hold it, both
named after the application identifier `xyz.hochreiner.maish`. Where they live
depends on the platform: Tauri's config and data directories are two separate
trees on Linux and the same folder on macOS.

| What | Linux | macOS |
|---|---|---|
| Database | `~/.config/xyz.hochreiner.maish/maish.db` | `~/Library/Application Support/xyz.hochreiner.maish/maish.db` |
| Encryption key | `~/.local/share/xyz.hochreiner.maish/maish.key` | `~/Library/Application Support/xyz.hochreiner.maish/maish.key` |
| Log | `~/.local/share/xyz.hochreiner.maish/logs/Maish.log` | `~/Library/Logs/xyz.hochreiner.maish/Maish.log` |

Starting without them gives you an empty client: add the account again and let
it sync. To carry an existing setup across, copy **both** files. The key alone
is useless, and the database alone cannot be read — every stored password and
token is encrypted with that key, and a missing key file is silently replaced by
a fresh one, after which login fails without an error dialog.

The key file is written lazily, on the first credential the app encrypts, so a
fresh installation has none until an account is added. Put the copied key in
place **before** the first start with the copied database, not after.

Copy the database with SQLite rather than `cp`, so the write-ahead log is
included — the WAL routinely holds several megabytes that the `.db` file does
not:

```bash
# Linux
sqlite3 "file:$HOME/.config/xyz.hochreiner.maish/maish.db?mode=ro" ".backup /path/to/target/maish.db"
```

```bash
# macOS
sqlite3 "file:$HOME/Library/Application Support/xyz.hochreiner.maish/maish.db?mode=ro" ".backup /path/to/target/maish.db"
```

## Commands

```bash
# Start Tauri dev (frontend + backend)
npm run tauri dev

# Vite dev server only (no Tauri)
npm run dev

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run a specific test file
npx vitest run src/stores/uiStore.test.ts

# Type-check
npx tsc --noEmit

# Build for production
npm run tauri build

# Rust only (from src-tauri/)
cd src-tauri && cargo build
```

## Testing

- **Framework:** Vitest + jsdom
- **Setup:** `src/test/setup.ts` (imports `@testing-library/jest-dom/vitest`)
- **Config:** `globals: true` -- no imports needed for `describe`, `it`, `expect`
- **Location:** Tests are colocated with source files (e.g., `uiStore.test.ts` next to `uiStore.ts`)
- **Count:** 154 test files across stores (8), services (87), utils (14), components (38), constants (3), router (1), hooks (2), and config (1)

### Zustand test pattern

```ts
beforeEach(() => {
  useStore.setState(initialState);
});

it('does something', () => {
  useStore.getState().someAction();
  expect(useStore.getState().value).toBe(expected);
});
```

## Building

```bash
# Build for your current platform
npm run tauri build
```

Produces native installers:
- **Windows** -- `.msi` / `.exe`
- **macOS** -- `.dmg` / `.app`
- **Linux** -- `.deb` / `.AppImage`

`bundle.createUpdaterArtifacts` is on, so every build also writes an updater
bundle (`.app.tar.gz` on macOS, the `.AppImage` on Linux, the installers on
Windows) next to the installers, and then signs it.

**Bundling now needs the updater signing key.** The bundles are written first and
the signing step runs after them, so without `TAURI_SIGNING_PRIVATE_KEY` the
command fails at the very end with `A public key has been found, but no private
key`. Two ways around it locally:

```bash
# Skip bundling entirely -- what this fork normally uses
npm run tauri build -- --no-bundle

# Bundle, but skip the signature
npm run tauri build -- --no-sign
```

## Release Artifacts

Releases are published by merging the release-please pull request. That creates
the tag and the GitHub release; `.github/workflows/build-release.yml` then builds
the app and attaches the bundles, their `.sig` files and a merged `latest.json`.
The updater reads that file from
`releases/latest/download/latest.json` (`plugins.updater.endpoints` in
`src-tauri/tauri.conf.json`).

The build runs on macOS arm64 only. Other platforms have to be added to the
workflow before their users see updates.

Two repository secrets are required:

| Secret | Purpose |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of the minisign private key matching `plugins.updater.pubkey` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password that key was generated with |

**The key must have a password, and the second secret is not optional**, even
though Tauri's own documentation calls it so. On CI the CLI substitutes an empty
string for a missing password rather than treating the key as unencrypted, so a
key generated without one fails the build with `incorrect updater private key
password: Wrong password for that key`. Verified against CLI 2.10.0.

A new key pair is generated with:

```bash
npm run tauri signer generate -- -w ~/.tauri/maish.key -p '<password>'
```

The public half has to be copied into `plugins.updater.pubkey`. Replacing the key
invalidates every update for clients that already shipped with the old public
key, so this is a one-way step.

Re-running a build, or filling in a release published before this workflow
existed, is done by dispatching **Build Release Artifacts** manually with the tag
(for example `maish-v0.1.1`). Tags older than the `createUpdaterArtifacts` change
produce installers but no `.sig` files and no `latest.json`.

## Email Account Setup

### Gmail (OAuth)

Maish connects directly to Gmail via OAuth. You need your own Google Cloud credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Gmail API** and **Google Calendar API**
4. Create OAuth 2.0 credentials (Desktop application)
5. In Maish's Settings, enter your Client ID

> Maish uses PKCE flow -- no client secret is required.

### IMAP/SMTP

For non-Gmail providers (Outlook, Yahoo, iCloud, Fastmail, etc.):

1. Click the account switcher in the sidebar → **Add IMAP Account**
2. Enter your email address and password (or app-password)
3. Maish auto-discovers server settings for well-known providers
4. For other providers, enter IMAP/SMTP host, port, and security manually
5. Test connection, then save

> No Google Cloud project or Client ID needed. Passwords are encrypted with AES-256-GCM in the local database. Some providers (e.g., Gmail, Yahoo) require an app-specific password instead of your main password.

## AI Setup (Optional)

To enable AI features, add your API key for one or more providers in Settings:

- **Anthropic Claude** -- [Get API key](https://console.anthropic.com/) -- Haiku 4.5 (default), Sonnet 4, Opus 4
- **OpenAI** -- [Get API key](https://platform.openai.com/) -- GPT-4o Mini (default), GPT-4o, GPT-4.1 series
- **Google Gemini** -- [Get API key](https://aistudio.google.com/) -- 2.5 Flash (default), 2.5 Pro

After adding an API key, select which model to use for each provider in Settings > AI.
