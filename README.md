# Vault Mirror

[中文说明](./README.zh-CN.md) · [Safety](./docs/SAFETY.md) · [Privacy](./docs/PRIVACY.md) · [Release guide](./docs/RELEASE.md)

![Vault Mirror safely mirrors an Obsidian vault to a local cloud-synced folder.](./assets/vault-mirror-hero.png)

**Vault Mirror** is a macOS-only Obsidian desktop plugin for safely mirroring the vault you currently have open to another local folder—such as an iCloud Drive vault for use on iPhone.

It is intentionally a **one-way** mirror:

```text
Current Obsidian vault (source of truth) → local destination folder
```

Vault Mirror runs only on your Mac. It does not connect to Baidu Netdisk, iCloud, or any other cloud API. Your existing sync clients remain responsible for moving files between devices.

> [!warning]
> Vault Mirror is not a backup tool and it is not two-way sync. Destination-only files and edits can be overwritten or deleted during the next mirror. Keep an independent backup of important data.

## Why Vault Mirror?

If your primary vault lives in one desktop sync folder but your iPhone vault needs to live in iCloud Drive, Vault Mirror provides a deliberate bridge on macOS:

1. Open your primary vault in Obsidian on your Mac.
2. Choose an existing iCloud Drive vault as the destination once.
3. Review the live change plan.
4. Confirm a safe, one-way mirror run.

The plugin copies notes, attachments, hidden files, and `.obsidian` configuration by default. It also removes destination-only files only after all creates and updates have completed successfully.

## Highlights

- **Current vault as source** — no source path to configure.
- **Choose the destination once** — select an existing local folder, including an iCloud Drive vault.
- **Live preview** — every run scans both folders again and displays the current plan before applying it.
- **Note-first summary** — prominently shows changed Markdown notes, while retaining totals for all files and configuration.
- **Safe mirror order** — scan → compare → plan → stage copies → update → delete.
- **Deletion safeguards** — warns about large deletions; never enters the delete phase when copying or verification fails.
- **Atomic updates and rollback** — changed files are staged first; existing destination files are backed up during commit and restored if a commit fails.
- **Source stability checks** — waits for the source folder to settle before planning, helpful when desktop sync clients are still creating or removing temporary files.
- **Privacy-first** — no account, network transfer, telemetry, or cloud API.

## Preview and progress

The preview is a fresh scan, not a cached summary. It highlights changed Markdown notes separately from attachments and Vault configuration, and shows the exact source and destination paths before any write occurs.

![Chinese sync preview mockup showing the live note-change total and file-change details.](./assets/sync-preview-zh.svg)

During a run, Vault Mirror shows the current phase and progress for comparison, copying, updating, verification, and deletion. When the source is still changing, it waits for the filesystem to settle before it creates a plan.

## Installation

### From the Obsidian Community directory

After this plugin has passed the Obsidian Community review, install it from **Settings → Community plugins**, then enable **Vault Mirror**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the matching GitHub release.
2. Create this folder inside the vault that will run the plugin:

   ```text
   <Your Vault>/.obsidian/plugins/vault-mirror/
   ```

3. Copy the three downloaded files into that folder.
4. Reload Obsidian.
5. Enable **Vault Mirror** in **Settings → Community plugins**.

## Setup and use

1. Open the **source vault** in Obsidian on macOS. This is the only source Vault; it cannot be changed in the plugin settings.
2. Open **Settings → Community plugins → Vault Mirror**.
3. Under **Destination folder**, select the exact existing destination Vault folder—for example, your iCloud Drive vault folder, not its parent `Documents` folder.
4. Click the cloud-upload icon in the left Ribbon, or run **Vault Mirror: Sync to iCloud** from the Command Palette.
5. Wait for the live scan to complete. Review the note count, full file-change count, source, destination, and deletion warning.
6. Select **开始同步** to apply the plan.
7. Read the result modal before closing it. The latest 20 runs are also stored in the plugin settings.

## How mirroring works

For every relative path, Vault Mirror creates one of four operations:

| Source / destination state | Operation |
| --- | --- |
| Exists only in source | Create |
| Exists in both but differs | Update |
| Exists only in destination | Delete |
| Same content | Skip |

All creates and updates are staged before any planned deletion. If a source file disappears while a desktop sync client is working, the plugin re-scans and asks for a new confirmation instead of treating that transient state as a successful mirror.

## Safety model

Vault Mirror refuses to run when:

- source and destination are the same folder;
- either folder is inside the other;
- the destination does not exist or is not writable;
- another Vault Mirror job is already running;
- a symbolic link is encountered;
- the source folder does not settle after repeated checks.

The default exclusion is `.DS_Store`. You can add exact file or folder rules in **Advanced → Excluded files**. `.obsidian` is included by default.

Read the full [safety guide](./docs/SAFETY.md) before using this plugin with a non-empty destination.

## Requirements and limitations

- macOS desktop Obsidian only.
- Obsidian 1.5.0 or later.
- The destination must already exist.
- One-way mirror only; no conflict resolution and no destination-to-source writes.
- No automatic file watching or scheduled sync in this release.
- Destination-side iPhone edits and device-specific `.obsidian` files may appear as changes on the next preview. This is expected for a mirror whose source is authoritative.

## Privacy

Vault Mirror operates on local filesystem paths only. It does not send vault content, paths, metadata, analytics, or credentials to any service. See [Privacy](./docs/PRIVACY.md).

## Development

```bash
pnpm install
pnpm test
pnpm build
```

The production build creates `main.js` in the repository root. The test suite covers creation, update, deletion, nested folders, binary files, `.obsidian`, path safety, concurrent jobs, source changes during staging, and note-change counting.

## Release

For each release, keep the Git tag exactly equal to the version in `manifest.json`, then attach these files to the GitHub release:

- `main.js`
- `manifest.json`
- `styles.css`

See the [release guide](./docs/RELEASE.md) for the full checklist.

## License

[MIT](./LICENSE)
