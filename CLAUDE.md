# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Token hygiene — say this out loud, repeatedly

**Recommend a fresh session whenever the topic changes, and again once a session
has run long.** Do not wait to be asked, and do not mention it once and drop it.
A user who declines still gets reminded at the next topic change.

The reason is **quality, not cost**. Everything already in the window competes
for attention: an unrelated debugging thread from an hour ago pulls answers
toward stale files and dead hypotheses. Once the window fills, automatic
compaction summarises the history and silently discards detail — often the one
constraint that mattered. A fresh session with a written handover keeps the
signal and drops the noise.

Every reminder has **two parts**:

1. Two to four sentences of plain language — what is about to be lost and why a
   new session is the better move. No jargon, no token counts.
2. A ready-to-paste prompt as a blockquote, so the next session starts warm.

Example:

> We have been on the CalDAV transport for a while, and you are now asking about
> packaging — a different corner of the project. The old thread will keep pulling
> my attention toward files that no longer matter, and once the history gets
> compacted I may lose the details that made the fix work. Better to start fresh
> and carry over only what counts. Paste this:
>
> > Maish (fork of Velo), `/home/simon/Desktop/github/velo`, branch `main`.
> > Read `CLAUDE.md` first. Task: build Flatpak packaging for the renamed app.
> > Relevant files: `xyz.hochreiner.maish.yml`, `maish.spec`. The rename to
> > `xyz.hochreiner.maish` is done and pushed; the app identifier, database file
> > and packaging metadata all moved. Nothing about CalDAV is needed here.

Write the handover prompt so it stands on its own: repo path, branch, task,
relevant files, decisions already made, and what explicitly does not matter.

## This is Maish

Maish began as a fork of Velo (`avihaymenahem/velo`, Apache-2.0) and is now
maintained independently as `Seemops1337/maish`. Upstream is no longer tracked:
there is no `upstream` remote, no shared branding, and no plan to send further
changes there. Five pull requests opened before the split are left open at
`avihaymenahem/velo`; nothing depends on their outcome.

What Apache-2.0 still requires, and what must therefore stay:

- `LICENSE` — the full licence text
- `NOTICE` — the record of modifications under section 4(b); **keep it current
  when you change behaviour**
- The upstream copyright line in the About panel
  (`src/components/settings/SettingsPage.tsx`), retained under section 4(c)
  alongside the Maish one

Identity is `Maish` / `xyz.hochreiner.maish`; the binary is
`src-tauri/target/release/maish`.

Four behavioural changes carried over from the fork are described under
Fork-specific behaviour below: IMAP FETCH parentheses, transactions on a
dedicated SQLite connection, CalDAV over the Rust HTTP client, and CalDAV
attaching to an existing account.

## Working rules

**Branch per change.** Never commit to `main` directly — not for a one-line fix
either. Branch, commit, verify, then merge. `fix/<slug>` for bugfixes,
`feat/<slug>` for features, `docs/`, `chore/`, `debug/` for the rest. Throwaway
branches for instrumentation get deleted once the question is answered.

**Everything in the repository is English.** Code, identifiers, comments,
commit messages, documentation, `NOTICE`, pull requests, issue comments, UI
strings — no exceptions, including throwaway debug output that might get
committed by accident. The chat itself follows whatever language the maintainer
writes in, which is usually German; that never leaks into a file or a commit.

**Publishing needs approval.** Push, pull request, issue comment: draft the
exact text, show it, wait. Local branches and commits need no permission.

**Releasing is the maintainer's decision alone.** release-please keeps one pull
request open and rewrites it on every push to `main`. That pull request is
read-only here: never merge, close or edit it, and never create a tag or change a
version number by hand. Read it and explain what it proposes when asked, then
wait for the explicit instruction — merging it is what publishes a release, and
nothing else may trigger one.

**Look it up instead of recalling it.** Library behaviour, RFC wording, API
shapes and config keys get read from the source — the installed package under
`node_modules`, the crate source, the actual RFC, current documentation on the
web. Memory of a library is a snapshot of some past version and is wrong often
enough to cost more time than the lookup. Two examples from this repository, both
of which cost a full debugging round because they were assumed rather than read:
tsdav prefers `globalThis.fetch` and treats `cross-fetch` as a fallback, and
`@tauri-apps/plugin-http` ignores `redirect` and understands only
`maxRedirections`.

**Evidence before claims.** Do not report something as fixed, passing or done
without having run the command and read the output. When a bug is not
understood, instrument the boundaries and read what actually happens rather than
reasoning forward from a plausible story — the guess is wrong often enough that
the instrumentation is cheaper. Bugfixes start with a failing test.

**Corrections go in NOTICE.** Any behavioural change to forked code is a
modification under Apache-2.0 section 4(b) and belongs in `NOTICE`.

## Versioning

Semantic versioning, currently **0.1.0** — the fork restarted its numbering and
does not continue Velo's 0.4.x line. `CHANGELOG.md` begins at that release and
carries no Velo entries; its header records why the numbering restarts.

| Change | Bump | Commit type |
|---|---|---|
| Bugfix | +0.0.1 | `fix:` |
| Feature | +0.1.0 | `feat:` |
| Breaking change, below 1.0.0 | +0.1.0 | `feat!:` / `BREAKING CHANGE:` |
| First stable release | 1.0.0 | manual |

release-please derives the bump from Conventional Commit types, so the commit
type is the version decision — `docs:`, `chore:`, `refactor:`, `test:` and `ci:`
trigger no release. `bump-minor-pre-major` keeps breaking changes at a minor
bump until 1.0.0 is cut deliberately: while the version starts with `0.`, a
`feat!:` produces 0.2.0, **not** 1.0.0. Reaching 1.0.0 is a manual act, never a
side effect of a commit message.

The version appears in `package.json`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`, `maish.spec`,
`xyz.hochreiner.maish.metainfo.xml` and `.release-please-manifest.json`.
release-please keeps them in sync; edit them by hand only when changing the
scheme itself.

## Commands

```bash
# Development — starts Tauri app with Vite dev server (port 1420)
npm run tauri dev

# Build production app
npm run tauri build

# Release build without installers — what this fork normally uses (~3 min)
npm run tauri build -- --no-bundle

# Run it (KDE/Wayland: the app needs an X authority handed to it)
DISPLAY=:0 XAUTHORITY=$(ls -t /run/user/1000/xauth_* | head -1) ./src-tauri/target/release/maish

# Vite dev server only (no Tauri)
npm run dev

# Run all tests (single run)
npm run test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx vitest run src/stores/uiStore.test.ts

# Type-check only (no emit)
npx tsc --noEmit

# Rust backend only (from src-tauri/)
cargo build
cargo test
```

## Architecture

Tauri v2 desktop app: Rust backend + React 19 frontend communicating via Tauri IPC.

### Three-layer data flow

1. **Rust backend** (`src-tauri/`): System tray, minimize-to-tray (hide on close), splash screen, OAuth localhost server (port 17248, PKCE), single-instance enforcement, autostart support, IMAP/SMTP client modules. Tauri commands: `start_oauth_server`, `close_splashscreen`, `set_tray_tooltip`, `open_devtools`, 5 transaction commands (`db_tx_begin`, `db_tx_execute`, `db_tx_select`, `db_tx_commit`, `db_tx_rollback`, see Fork-specific behaviour), plus 11 IMAP commands (`imap_test_connection`, `imap_list_folders`, `imap_fetch_messages`, `imap_fetch_new_uids`, `imap_fetch_message_body`, `imap_set_flags`, `imap_move_messages`, `imap_delete_messages`, `imap_get_folder_status`, `imap_fetch_attachment`, `imap_append_message`) and 2 SMTP commands (`smtp_send_email`, `smtp_test_connection`). Rust IMAP uses `async-imap` + `mail-parser`, SMTP uses `lettre`. Plugins: sql (SQLite), notification, opener, log, dialog, fs, http, single-instance, autostart, deep-link (`mailto:` scheme), global-shortcut. Windows-specific: sets AUMID for proper notification identity.

2. **Service layer** (`src/services/`): All business logic. Plain async functions (not classes, except `GmailClient`).
   - `db/` — SQLite queries via `getDb()` singleton from `connection.ts`. Version-tracked migrations in `migrations.ts`. FTS5 full-text search on messages (trigram tokenizer). 32 service files covering accounts, messages, threads, labels, contacts, filters, templates, signatures, attachments, scheduled emails, image allowlist, search, settings, AI cache, bundle rules, calendar events, follow-up reminders, notification VIPs, thread categories, send-as aliases, smart folders, quick steps, link scan results, phishing allowlist, folder sync state, and smart label rules.
   - `email/` — `EmailProvider` abstraction unifying Gmail API and IMAP/SMTP behind a single interface. `providerFactory.ts` returns appropriate provider based on `account.provider` field ("gmail_api" or "imap"). `gmailProvider.ts` wraps existing GmailClient. `imapSmtpProvider.ts` delegates to Rust IMAP/SMTP Tauri commands.
   - `gmail/` — `GmailClient` class auto-refreshes tokens 5min before expiry, retries on 401. `tokenManager.ts` caches clients per account in a Map. `syncManager.ts` orchestrates sync (60s interval) for both Gmail and IMAP accounts via the EmailProvider abstraction. `sync.ts` does initial sync (365 days, configurable via `sync_period_days` setting) and delta sync via Gmail History API; falls back to full sync if history expired (~30 days). `authParser.ts` parses SPF/DKIM/DMARC from `Authentication-Results` headers. `sendAs.ts` fetches send-as aliases from Gmail API.
   - `imap/` — IMAP-specific services. `tauriCommands.ts` wraps Rust IMAP Tauri commands. `imapSync.ts` orchestrates IMAP initial sync (batch fetch, 50 messages/batch) and delta sync via UIDVALIDITY/last_uid tracking. `folderMapper.ts` maps IMAP folders (special-use flags + well-known names) to Gmail-style labels. `autoDiscovery.ts` provides pre-configured server settings for 7 major providers (Outlook, Yahoo, iCloud, AOL, Zoho, FastMail, GMX). `imapConfigBuilder.ts` builds IMAP/SMTP configs from account records. `messageHelper.ts` handles IMAP message utilities.
   - `contacts/` — CardDAV address books. `carddavProvider.ts` talks to tsdav with `fetch: davFetch` and `defaultAccountType: "carddav"`; `vcardHelper.ts` reads and writes vCard 3.0/4.0; `vcardEdit.ts` patches a stored card in place; `contactSync.ts` stores what a run fetched and folds mail-derived rows into the card that claims their address; `contactActions.ts` is the write path from the UI; `autoDiscovery.ts` and `providerFactory.ts` mirror their calendar counterparts. See Contacts have two origins under Key Gotchas.
   - `dav/` — `contentLine.ts`, the line format iCalendar and vCard share: unfolding, parameter quoting, text escaping, folding.
   - `threading/` — JWZ threading algorithm (`threadBuilder.ts`) for grouping IMAP messages into conversation threads using Message-ID, References, and In-Reply-To headers. Supports incremental threading, phantom containers for missing references, and subject-based merging.
   - `ai/` — `aiService.ts` provides thread summaries, smart replies, AI compose, text transform, auto-categorization, smart label classification, and task extraction. `providerManager.ts` manages three providers (`providers/claudeProvider.ts`, `providers/openaiProvider.ts`, `providers/geminiProvider.ts`). `askInbox.ts` enables natural language inbox queries. `categorizationManager.ts` auto-sorts threads into Primary/Updates/Promotions/Social/Newsletters. `writingStyleService.ts` analyzes user writing style from sent emails and generates auto-draft replies. `taskExtraction.ts` extracts tasks from email threads via AI. `errors.ts` and `types.ts` define shared AI types. Results cached locally via `db/aiCache.ts`.
   - `google/` — `calendar.ts` handles Google Calendar API (list calendars, fetch events, create events, token refresh).
   - `calendar/` — `CalendarProvider` abstraction over Google Calendar and CalDAV, selected by `providerFactory.ts`. `caldavProvider.ts` talks to tsdav, always with `fetch: davFetch`. `icalHelper.ts` parses iCalendar into a component tree and builds VEVENTs; `icalEdit.ts` patches a stored calendar object in place; `recurrence.ts` expands RRULE/RDATE/EXDATE into instances; `recurrenceForm.ts` translates between an RRULE and the handful of rules the repeat control can state; `timezone.ts` converts between wall-clock time in an IANA zone and epoch seconds via `Intl`; `occurrences.ts` bridges stored rows and the instances a view renders. See Recurring events under Key Gotchas.
   - `composer/` — `draftAutoSave.ts` auto-saves drafts every 3 seconds (debounced). Watches composer state changes via Zustand subscribe.
   - `search/` — `searchParser.ts` parses Gmail-style operators (`from:`, `to:`, `subject:`, `has:attachment`, `is:unread/read/starred`, `before:`, `after:`, `label:`). `searchQueryBuilder.ts` builds SQL queries from parsed operators.
   - `filters/` — `filterEngine.ts` auto-applies filters to incoming messages during sync. Criteria use AND logic (case-insensitive substring matching). Actions: applyLabel, archive, trash, star, markRead.
   - `categorization/` — `ruleEngine.ts` applies rule-based categorization (pattern matching on sender/subject) before falling back to AI.
   - `snooze/` — Background interval checkers for snooze unsnooze and scheduled sends.
   - `followup/` — `followupManager.ts` checks for follow-up reminders (threads with no reply after user-set delay).
   - `bundles/` — `bundleManager.ts` manages newsletter bundling with delivery schedules.
   - `notifications/` — `notificationManager.ts` provides OS notifications via tauri-plugin-notification with VIP sender filtering.
   - `contacts/` — `gravatar.ts` fetches Gravatar profile images for contacts.
   - `attachments/` — `cacheManager.ts` handles local attachment caching with size limits. `preCacheManager.ts` background pre-caches recent small attachments (<5MB, 7 days) every 15 minutes.
   - `unsubscribe/` — `unsubscribeManager.ts` handles one-click unsubscribe (RFC 8058 List-Unsubscribe-Post and mailto: fallback).
   - `quickSteps/` — Custom action chain executor with 18 action types. `executor.ts` runs action sequences on threads. `defaults.ts` provides preset templates. `types.ts` defines action chain schema.
   - `queue/` — `queueProcessor.ts` processes offline operation queue every 30s. Compacts redundant ops, retries with exponential backoff (60s→300s→900s→3600s), marks permanently failed ops.
   - `tasks/` — `taskManager.ts` handles recurring task logic: `parseRecurrenceRule`, `calculateNextOccurrence` (daily/weekly/monthly/yearly), `handleRecurringTaskCompletion` (completes current, creates next).
   - `smartLabels/` — AI-powered auto-labeling. `smartLabelService.ts` two-phase matching (criteria fast path + AI classification). `smartLabelManager.ts` sync integration orchestrator. `backfillService.ts` batch-applies to existing inbox emails.
   - Root-level services: `emailActions.ts` (centralized offline-aware email action service — optimistic UI, local DB updates, offline queueing), `badgeManager.ts` (taskbar badge count), `deepLinkHandler.ts` (`mailto:` protocol handling), `globalShortcut.ts` (system-wide compose shortcut).

3. **UI layer** (`src/components/`, `src/stores/`): Nine Zustand stores (`uiStore`, `accountStore`, `threadStore`, `composerStore`, `labelStore`, `contextMenuStore`, `shortcutStore`, `smartFolderStore`, `taskStore`) — simple synchronous state, no middleware. Components subscribe directly via hooks.

### Component organization

14 groups, ~104 component files:
- `layout/` — Sidebar, EmailList, ReadingPane, TitleBar
- `email/` — ThreadView, ThreadCard, MessageItem, EmailRenderer, ActionBar, AttachmentList, SnoozeDialog, ContactSidebar, FollowUpDialog, InlineAttachmentPreview, InlineReply, SmartReplySuggestions, ThreadSummary, AuthBadge, AuthWarningBanner, PhishingBanner, LinkConfirmDialog, CategoryTabs, MoveToFolderDialog
- `composer/` — Composer (TipTap v3 rich text editor), AddressInput, EditorToolbar, AttachmentPicker, ScheduleSendDialog, SignatureSelector, TemplatePicker, UndoSendToast, AiAssistPanel, FromSelector
- `search/` — CommandPalette, SearchBar, ShortcutsHelp, AskInbox
- `settings/` — SettingsPage, FilterEditor, LabelEditor, SignatureEditor, TemplateEditor, ContactEditor, SubscriptionManager, QuickStepEditor, SmartFolderEditor, CalDavSettings, CardDavSettings
- `accounts/` — AddAccount, AddImapAccount, AddCalDavAccount, AddCardDavAccount, AccountSwitcher, SetupClientId
- `calendar/` — CalendarPage, CalendarList, CalendarReauthBanner, CalendarToolbar, DayView, WeekView, MonthView, EventCard, EventCreateModal, EventDetailModal, RecurrenceField
- `contacts/` — ContactsPage, ContactDetail
- `attachments/` — AttachmentLibrary, AttachmentGridItem, AttachmentListItem
- `tasks/` — TasksPage, TaskItem, TaskQuickAdd, TaskSidebar, AiTaskExtractDialog
- `help/` — HelpPage, HelpSidebar, HelpSearchBar, HelpCard, HelpCardGrid, HelpTooltip
- `labels/` — LabelForm
- `dnd/` — DndProvider (@dnd-kit drag-and-drop: threads → sidebar labels)
- `ui/` — EmptyState, Skeleton, ContextMenu, ContextMenuPortal, OfflineBanner, illustrations/ (InboxClearIllustration, NoAccountIllustration, NoSearchResultsIllustration, ReadingPaneIllustration, GenericEmptyIllustration)

### Multi-window support

Thread pop-out windows via `ThreadWindow.tsx`. Entry point in `main.tsx` checks URL params (`?thread=...&account=...`) to render `<ThreadWindow />` or `<App />`. Window label format: `thread-{threadId}`. Tauri capabilities allow `thread-*` wildcard. Default size: 800x700. Splash screen window (400x300, no decorations, always on top) shown during initialization.

### Startup sequence (App.tsx)

1. `runMigrations()`
2. Restore persisted settings: theme, color theme, sidebar, contact sidebar, reading pane position, read filter, email list width, email density, default reply mode, mark-as-read behavior, send & archive, font scale, inbox view mode, phishing detection, sidebar nav config
3. Load custom keyboard shortcuts (`shortcutStore.loadKeyMap()`)
4. `getAllAccounts()` → `initializeClients()` (Gmail API clients) / create IMAP providers → `fetchSendAsAliases()` per Gmail account
5. `startBackgroundSync()` (60s interval), `backfillUncategorizedThreads()`
6. `startSnoozeChecker()` + `startScheduledSendChecker()` + `startFollowUpChecker()` + `startBundleChecker()` (60s intervals) + `startQueueProcessor()` (30s) + `startPreCacheManager()` (15min)
7. Initialize network status detection (`online`/`offline` window events → `uiStore.setOnline()`, triggers queue flush on reconnect)
8. `initNotifications()` (request OS permission)
9. `initGlobalShortcut()` (system-wide compose shortcut)
10. `initDeepLinkHandler()` (`mailto:` protocol)
11. `updateBadgeCount()` (taskbar badge)
12. `close_splashscreen` → show main window
13. Cleanup on unmount: stop all background checkers (including queue processor, pre-cache manager), unregister shortcuts, deep link handler

### Cross-component communication

Custom window events: `velo-sync-done`, `velo-toggle-command-palette`, `velo-toggle-shortcuts-help`, `velo-toggle-ask-inbox`, `velo-move-to-folder`. Tray emits `tray-check-mail` via Tauri event system. `single-instance-args` event for deep link forwarding.

### Keyboard shortcuts

`useKeyboardShortcuts` hook in App.tsx — Superhuman-style keys. Skips when input/textarea/contentEditable is focused. Supports two-key sequences (only `g` prefix currently) with 1s timeout via refs. Shortcut definitions in `src/constants/shortcuts.ts`. Customizable via `shortcutStore` (persisted to SQLite settings).

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate threads down/up |
| `o` / `Enter` | Open thread |
| `e` | Archive |
| `s` | Star/unstar |
| `p` | Pin/unpin |
| `m` | Mute/unmute thread |
| `c` | Compose new email |
| `r` | Reply |
| `a` | Reply all |
| `f` | Forward |
| `u` | Unsubscribe |
| `t` | Create task from email (AI) |
| `v` | Move to folder/label |
| `#` / `Delete` / `Backspace` | Trash (permanent delete if already in trash) |
| `!` | Report spam / Not spam (context-aware) |
| `/` or `Ctrl+K` | Command palette / search |
| `?` | Shortcuts help |
| `Escape` | Close composer → clear multi-select → deselect thread (hierarchical) |
| `Ctrl+Shift+E` | Toggle sidebar |
| `Ctrl+Enter` | Send email (in composer) |
| `Ctrl+A` | Select all threads |
| `Ctrl+Shift+A` | Select all threads from current position |
| `g` then `i` | Go to Inbox |
| `g` then `s` | Go to Starred |
| `g` then `t` | Go to Sent |
| `g` then `d` | Go to Drafts |
| `g` then `p` | Go to Primary |
| `g` then `u` | Go to Updates |
| `g` then `o` | Go to Promotions |
| `g` then `c` | Go to Social |
| `g` then `n` | Go to Newsletters |
| `g` then `k` | Go to Tasks |
| `g` then `a` | Go to Attachments |

Multi-select: click to toggle, Shift+click for range. All keyboard actions work on multi-selected threads.

## Styling

Tailwind CSS v4 — uses `@import "tailwindcss"`, `@theme {}` for custom properties, and `@custom-variant dark` in `src/styles/globals.css`. Dark mode toggles via `<html class="dark">` which swaps CSS custom properties. Font scaling via `font-scale-{small|default|large|xlarge}` classes on `<html>`.

**Semantic color tokens**: `bg-bg-primary/secondary/tertiary/hover/selected`, `text-text-primary/secondary/tertiary`, `border-border-primary/secondary`, `bg-accent/accent-hover/accent-light`, `bg-danger/warning/success`, `bg-sidebar-bg`, `text-sidebar-text`.

**Glass effects**: `.glass-panel`, `.glass-modal`, `.glass-backdrop` utility classes with blur and shadow properties.

**Color themes**: 8 accent color presets (Indigo, Rose, Emerald, Amber, Sky, Violet, Orange, Slate) defined in `src/constants/themes.ts`. Each has light & dark variants. Applied via CSS custom properties, independent of light/dark mode.

**Background**: Animated gradient blobs (5 blobs with radial gradients, keyframe animations). Light mode uses blue→purple→pink→orange→cyan gradient; dark mode uses darker blues/purples.

**Icons**: `lucide-react` icon library.

## Testing

Vitest + jsdom. Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom/vitest`). Config: `globals: true` (no imports needed for `describe`, `it`, `expect`). Tests are colocated with source files (e.g., `uiStore.test.ts` next to `uiStore.ts`). Zustand test pattern: `useStore.setState()` in beforeEach, assert via `.getState()`.

156 test files across stores (8), services (88), utils (15), components (38), constants (3), router (1), hooks (2), and config (1).

## Database

SQLite via Tauri SQL plugin. 25 migrations (version-tracked in `_migrations` table, transactional). Custom `splitStatements()` handles BEGIN...END blocks in triggers.

Data lives in `~/.config/xyz.hochreiner.maish/maish.db` (WAL), logs in `~/.local/share/xyz.hochreiner.maish/logs/Maish.log`. On macOS both the database and the key file sit in `~/Library/Application Support/xyz.hochreiner.maish/` and the log in `~/Library/Logs/xyz.hochreiner.maish/Maish.log` — see `docs/development.md` for the full table. The frontend has no log forwarding, so `console.log` never reaches that file — to trace frontend behaviour, add a temporary `#[tauri::command]` that calls `log::warn!` (app-level commands need no capability entry) rather than guessing.

Key tables (38 total): `accounts` (with `provider` "gmail_api"|"imap", IMAP/SMTP host/port/security fields, `auth_method`, encrypted `imap_password`, optional `imap_username`), `messages` (with FTS5 index `messages_fts`, `auth_results`, `message_id_header`, `references_header`, `in_reply_to_header`, `imap_uid`, `imap_folder`), `threads` (with `is_pinned`, `is_muted`), `thread_labels`, `labels` (with `imap_folder_path`, `imap_special_use`), `contacts` (frequency-ranked for autocomplete, with `first_contacted_at`; `source` tells a mail-derived row from a synced vCard, which also carries `address_book_id`, `dav_uid`, `dav_href`, `dav_etag`, `vcard_data`, `dav_emails`), `address_books` (CardDAV collections, with `ctag`/`sync_token`/`is_read_only`), `attachments` (with `cached_at`, `cache_size`, `imap_part_id`), `filter_rules` (criteria/actions as JSON), `scheduled_emails` (status: pending/sent/failed), `templates` (with optional keyboard shortcut), `signatures`, `image_allowlist`, `settings` (key-value store), `ai_cache`, `thread_categories`, `calendar_events` (with `rrule` and `recurrence_end` for series masters), `follow_up_reminders`, `notification_vips`, `unsubscribe_actions`, `bundle_rules`, `bundled_threads`, `send_as_aliases`, `smart_folders`, `link_scan_results`, `phishing_allowlist`, `quick_steps`, `folder_sync_state` (IMAP UIDVALIDITY/last_uid/modseq tracking per folder), `pending_operations` (offline action queue with retry/backoff), `local_drafts` (offline draft persistence), `writing_style_profiles` (AI writing style per account), `tasks` (full task management with priorities, subtasks, recurrence), `task_tags` (custom task tag colors), `smart_label_rules` (AI auto-labeling rules with optional criteria), `_migrations`.

## Fork-specific behaviour

These four are why the fork exists. Each was verified against a self-hosted
Stalwart server.

- **IMAP FETCH data lists are parenthesised** (`src-tauri/src/imap/client.rs`).
  RFC 3501 §6.4.5 requires `(UID FLAGS INTERNALDATE BODY.PEEK[])`; `async-imap`
  forwards the string verbatim. Dovecot tolerates the unparenthesised form,
  Stalwart evaluates only the leading `UID` and answers without `BODY[]` — the
  fetch succeeds and every message arrives empty
- **Transactions run on a dedicated SQLite connection**, not the plugin's pool
  (`src-tauri/src/db_tx.rs`, `src/services/db/connection.ts`). `tauri-plugin-sql`
  calls `Pool::connect()`, so `BEGIN`, the statements and `COMMIT` would each
  land on a different pooled connection — the one holding `BEGIN` keeps the
  write lock while the others block on it. `withTransaction()` uses the
  `db_tx_*` commands, and `getDb()` returns that same connection while a
  transaction is open so the db modules join it. `PRAGMA busy_timeout` does not
  fix this; it turns the immediate error into an indefinite hang. Two caveats:
  `lastInsertId` is always `0` on that connection, and UI reads during a
  transaction see uncommitted state
- **CalDAV runs over `@tauri-apps/plugin-http`**, never the webview
  (`src/services/calendar/davFetch.ts`). DAV servers send no CORS headers, so a
  webview PROPFIND always fails with `Load failed`, whatever `connect-src`
  allows. **Every `DAVClient` must be constructed with `fetch: davFetch`** —
  tsdav resolves its transport once at import time and prefers
  `globalThis.fetch`, so patching the global or aliasing `cross-fetch` does
  nothing. `davFetch` also translates `redirect: "manual"` into
  `maxRedirections: 0`, without which RFC 6764 discovery silently follows the
  `/.well-known/caldav` hop and never sees the 3xx. Two further traps live in
  the same library: it merges a call's parameters over the client's defaults
  one level deep, so a `headers` argument **replaces** the authorization header
  set at login and every write comes back 401 — pass the etag on the calendar
  object and let tsdav build the `If-Match` itself; and its write functions
  return the raw response and throw only on a transport failure, so a status
  has to be checked or a 401 or 412 passes for a successful save
- **CalDAV settings attach to an existing account** (`saveCalDavAccount()` in
  `src/services/db/accounts.ts`). `accounts.email` is UNIQUE and a calendar
  usually belongs to an address that already has a mail account, so inserting a
  second row fails. Discovery additionally probes `accounts.imap_host`, because
  self-hosted setups routinely split mail domain and server host

## Key Gotchas

- **Tauri SQL plugin config**: `preload` in tauri.conf.json must be an array `["sqlite:maish.db"]` — NOT an object/map
- **Renaming the app identity moves three data artifacts, not one**: the database (`~/.config/<identifier>/maish.db`), the AES key file (`~/.local/share/<identifier>/maish.key`, `KEY_FILE_NAME` in `src/utils/crypto.ts`) and the log directory. Those are the Linux paths; on macOS the first two collapse into `~/Library/Application Support/<identifier>/`, because Tauri's `AppConfig` and `AppData` resolve to the same folder there. Miss the key file and the app silently generates a new one — every stored credential then fails to decrypt, so sync stops without an error dialog. Carry both files over and confirm sync actually runs afterwards, not just that the database has rows
- **The database filename lives in three places and they must agree**: `preload` in tauri.conf.json, `Database.load()` in `src/services/db/connection.ts`, and the `db_tx` path in `src-tauri/src/lib.rs` `setup()`. Miss one and the app splits in half — pooled reads and writes hit one file while everything inside a transaction hits another, so the UI reads an empty database while sync fills the other one
- **Tauri Emitter trait**: Must `use tauri::Emitter;` to call `.emit()` on windows
- **Tauri capabilities**: Any new plugin needs explicit permissions added to `src-tauri/capabilities/default.json`. Windows allow `"main"`, `"splashscreen"`, and `"thread-*"` wildcard
- **Tauri window config**: Custom titlebar — macOS uses `titleBarStyle: "Overlay"`, Windows/Linux removes decorations programmatically in Rust setup. 1200x800 default, 800x600 minimum. Splash screen: 400x300, no decorations, center, always on top
- **Single instance**: `tauri-plugin-single-instance` must be first plugin registered. Forwards args for deep linking
- **Minimize-to-tray**: Use `.on_window_event()` on the Builder, not `window.on_window_event()`
- **Windows WebView2**: `Chrome_WidgetWin_0` error on close is benign — ignore it
- **Windows AUMID**: Set explicitly in Rust for proper notification identity (`xyz.hochreiner.maish`)
- **OAuth (Gmail)**: Localhost server tries ports 17248-17251. PKCE flow, no client secret. Client ID stored in SQLite settings table, configured by user in Settings
- **IMAP message IDs**: Format is `imap-{accountId}-{folder}-{uid}` — not the RFC Message-ID header
- **IMAP security mapping**: UI shows "SSL/TLS", "STARTTLS", "None" but config stores "ssl", "starttls", "none"
- **IMAP UIDVALIDITY**: If UIDVALIDITY changes on a folder, all cached UIDs are invalid — triggers full resync of that folder
- **IMAP folders vs labels**: IMAP has no native labels; folders are mapped to Gmail-style labels via `folderMapper.ts` using special-use flags and well-known name matching
- **IMAP passwords**: Encrypted with AES-256-GCM in SQLite (same crypto as OAuth tokens)
- **IMAP username**: Optional `imap_username` column on accounts — when set, used as login username for IMAP/SMTP instead of email. Falls back to email when null
- **IMAP auto-discovery**: Pre-configured for Outlook/Hotmail, Yahoo, iCloud, AOL, Zoho, FastMail, GMX; other providers require manual server entry
- **Provider abstraction**: All sync/send operations go through `EmailProvider` interface — use `getEmailProvider(account)` from `providerFactory.ts`, never call Gmail or IMAP APIs directly from components
- **Offline mode**: All email modify operations (archive, trash, star, read, send, labels, drafts) go through `emailActions.ts` which applies optimistic UI updates, local DB changes, and queues operations when offline. Never call `getGmailClient()` directly for modify operations — use the convenience wrappers (`archiveThread`, `trashThread`, `starThread`, etc.). Queue processor runs every 30s, compacts redundant ops, uses exponential backoff retries. Conflict detection in delta sync skips threads with pending local ops
- **Network detection**: `uiStore.isOnline` tracks connectivity via `navigator.onLine` + window `online`/`offline` events. Queue flush triggers automatically on reconnect
- **CSP**: Allows connections to googleapis.com, anthropic.com, openai.com, generativelanguage.googleapis.com, gravatar.com, googleusercontent.com
- **TypeScript strict mode**: `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess` are all enabled. Target ES2021, bundler module resolution, `moduleDetection: "force"`
- **Path alias**: `@/*` maps to `src/*`
- **Email HTML rendering**: DOMPurify sanitization, rendered in sandboxed iframe (`allow-same-origin` only). Strips remote images by default (uses `data-blocked-src` attributes), allowlist per sender
- **Plain-text bodies are linkified**: a message with no HTML part goes through `linkifyPlainText()` (`src/utils/linkify.ts`), which escapes the body and inserts anchors for http(s), `mailto:`, bare `www.` hosts and bare addresses. Escaping and matching happen in one pass on the raw text — escaping afterwards would show the anchors as text, matching afterwards would let a body containing `&`, `<` or `"` steer the match. The anchors are clicked like any other: the frame reports them over postMessage and `EmailRenderer` re-checks the scheme before handing the URL to the opener
- **Thread deletion**: Two-stage — first trash, then permanent delete from DB if already in trash
- **Snooze**: Removes INBOX label and adds SNOOZED label (not just a flag)
- **Draft auto-save**: 3-second debounce, not configurable
- **Gmail History API**: Expires after ~30 days, triggers automatic full sync fallback
- **Vite HMR**: Uses port 1421 when `TAURI_DEV_HOST` is set
- **Vite build**: Multi-page — `index.html` (main app) + `splashscreen.html`
- **Filter engine**: AND logic for criteria, merges actions when multiple filters match same message
- **AI providers**: API keys stored in SQLite settings table. Provider selected per-feature in settings. Results cached in `ai_cache` table
- **Deep links**: `mailto:` scheme registered via tauri-plugin-deep-link. Opens compose window with pre-filled recipient
- **Autostart**: Uses `--hidden` flag to start minimized to tray
- **Phishing detection**: 10 heuristic rules (IP URLs, homograph, suspicious TLDs, URL shorteners, display/href mismatch, suspicious paths, brand impersonation, dangerous protocols, free email impostor, subdomain spoofing). Sensitivity configurable (low/default/high). Results cached in `link_scan_results`. Wired in two places: `MessageItem` calls `scanMessageLinks()` when a message expands and renders `PhishingBanner` above the body, and passes the risky links to `EmailRenderer`, which shows `LinkConfirmDialog` before handing a flagged URL to `openUrl()`. "Trust this sender" writes to `phishing_allowlist`, which suppresses both. The cache stores link scores only — the sensitivity thresholds are applied on read (`applySensitivity()`), so changing the setting also affects messages scanned earlier
- **Auth display**: SPF/DKIM/DMARC parsed from `Authentication-Results` header. Aggregate verdict: pass/fail/warning/unknown. Stored in `messages.auth_results` column
- **Mute threads**: Sets `is_muted` flag, auto-archives. Muted threads suppressed from notifications during delta sync
- **Send-as aliases**: Fetched from Gmail `/settings/sendAs` API on account init (Gmail only). `FromSelector` shown in composer when account has multiple aliases
- **Smart folders**: Saved search queries with dynamic tokens (`__LAST_7_DAYS__`, `__LAST_30_DAYS__`, `__TODAY__`). Managed via `smartFolderStore`
- **Quick steps**: Custom action chains with 18 action types. Executor in `services/quickSteps/executor.ts`
- **Split inbox**: Category tabs (Primary/Updates/Promotions/Social/Newsletters) with backfill service for existing threads
- **Recurring events are expanded on the client**: a CalDAV time-range REPORT returns the series *master* carrying the RRULE, not the instances — RFC 4791 §7.8 has the server match expanded instances against the range but return the object as stored. Google hides this by expanding server side (`singleEvents: "true"`), so only CalDAV needs it. Instances are produced on read by `recurrence.ts` and never stored: the rule stays live, no rows go stale, and every instance of a series shares one href, which would collide on `UNIQUE(account_id, google_event_id)`. `calendar_events.rrule` and `recurrence_end` exist only so the range query can find a master whose own `start_time` lies before the viewed window
- **Never read iCalendar as a flat list of properties**: a VCALENDAR from Apple Calendar carries a VTIMEZONE whose DAYLIGHT and STANDARD blocks have their own `RRULE` and `DTSTART`. Matching `RRULE` as text misidentifies plain events as recurring — on a real 25-event calendar, 21 rows contained the string but only 6 were actual series. `parseIcalComponents()` tracks BEGIN/END nesting; use it rather than scanning lines
- **Recurrence is computed in DTSTART's zone, not UTC**: a weekly 18:00 appointment stays at 18:00 after a DST change, so its UTC instant moves by an hour. `recurrence.ts` iterates in wall-clock terms and converts through `timezone.ts` only at the boundaries. For the same reason an edit must write `DTSTART` back with its original `TZID` — rewriting it as UTC silently detaches the series from its zone
- **Editing a calendar object patches it, never regenerates it**: all components sharing a UID live in one CalDAV resource, so rebuilding the VEVENT from the composer's fields discards the rule, the VTIMEZONE, alarms and per-instance overrides. Use `icalEdit.ts`; changing one occurrence writes a `RECURRENCE-ID` override, deleting one adds an `EXDATE`, and "this and following" bounds the original with `UNTIL` and stores the tail as a second object (`THISANDFUTURE` is spec'd but patchily supported)
- **A repeat control may only write rules it can read back**: `recurrenceForm.ts` reports anything richer than FREQ/INTERVAL/BYDAY/COUNT/UNTIL as `custom`, and the UI then shows that rule without offering to edit it. Rebuilding `FREQ=MONTHLY;BYDAY=3TH` from four frequencies would move every instance of a series another client wrote. For the same reason an untouched control sends no `recurrence` field at all — `undefined` keeps the stored rule, `null` removes it
- **Changing a rule clears EXDATE and the overrides**: both are anchored to instance times the old rule produced, and the expander renders an override whose `RECURRENCE-ID` no instance matches. `applyRule()` in `icalEdit.ts` drops them, but only when the rule really changed; RDATE survives, being independent of the rule
- **An all-day event's end is exclusive on both sides of the wire**: `DTEND` for a DATE value (RFC 5545 §3.6.1) and the Google API's `end.date` both name the day *after* the last one the event covers, and the calendar views bucket by the same half-open overlap. The dialogs ask for and show the day the event ends on, which is what a reader expects, and translate in both directions through `src/services/calendar/allDay.ts` — `dayRange()` on the way out, `lastDayInstant()` on the way back in. Sending the picked day verbatim yields a zero-length event
- **Whether an event is all day is fixed once it exists**: `UpdateEventInput.isAllDay` states what the event already is, so the Google provider keeps writing `start.date` instead of silently converting it on the next save; it is not a switch. `icalEdit.ts` derives the value type from the stored `DTSTART` and writes every date of the object in it — `DTSTART`, `DTEND`, `EXDATE`, `RECURRENCE-ID`, a rule's `UNTIL` — so a conversion means rewriting all of them together, and a `RECURRENCE-ID` left in the old form stops matching its instance. The edit dialog therefore shows the switch disabled rather than offering a change no provider here can carry out
- **Contacts have two origins and one table**: a row either came from a mail header (`address_book_id IS NULL`) or from a synced vCard. `contacts.email` is no longer NOT NULL UNIQUE — a card may carry several addresses or none — so uniqueness is two partial indexes: one address per mail-derived row, one UID per address book. The server owns identity (name, organisation, photo); the local row owns usage (`frequency`, `last_contacted_at`), which no server knows and no sync may overwrite. `upsertContact` therefore bumps the card that already claims an address instead of creating a second row, and `contactSync` absorbs a mail-derived row into that card, carrying a user-written note onto the server first so nothing is dropped
- **A vCard is patched, never regenerated**: same reasoning as `icalEdit.ts` — a card carries the photo, the birthday, `X-ABLabel` groups and whatever else another client wrote, and rebuilding it from the form's fields discards all of it. `vcardEdit.ts` also writes in the card's own version: 3.0 marks the preferred address `TYPE=WORK,PREF`, 4.0 uses a separate `PREF=1`, and the wrong form is refused by some servers. Parameter values are not text values — escaping the comma between two TYPEs turns them into one type literally called `WORK\,PREF`
- **A CardDAV client is its own client**: `defaultAccountType` decides whether discovery looks for `addressbook-home-set` or `calendar-home-set`, so the calendar's `DAVClient` cannot be reused for contacts. tsdav's `fetchAddressBooks` also drops any property outside the few it maps, which is why read-only detection needs a separate propfind. A collection URL is normalised to end in a slash: tsdav resolves a new card's filename with `new URL(filename, book.url)`, and without the slash the card is written one level above the address book
- **Help page**: In-app help at `/help/$topic` with 13 categories, searchable cards, and contextual `HelpTooltip` component. All content in `src/constants/helpContent.ts`. After adding a new feature, run `/document-feature` to add its help card
