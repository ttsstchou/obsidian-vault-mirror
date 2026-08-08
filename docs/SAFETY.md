# Safety guide

Vault Mirror makes the destination folder follow the source folder. Read this page before the first sync.

## Source is authoritative

The Vault currently open in Obsidian is the only source of truth. Vault Mirror never imports destination changes into the source. A note changed only on iPhone can be overwritten on the next mirror run.

## Choose the exact destination Vault

Select the target Vault itself, for example:

```text
~/Library/Mobile Documents/iCloud~md~obsidian/Documents/My iPhone Vault
```

Do not select a parent folder that contains multiple Vaults or unrelated files. The destination must already exist.

## Deletions are deliberate

Files that exist in the destination but not in the source are planned for deletion. Vault Mirror shows a preview for the first sync and for any sync with deletions, and highlights mass deletion plans.

Copying and updating occur before planned deletions. If scanning, copying, staging, or verification fails, the delete phase does not run.

## Filesystem protections

The plugin refuses source and destination folders that are identical, nested inside one another, missing, or not folders. It also rejects symbolic links to prevent accidentally traversing outside either Vault.

## Sync-client activity

Desktop sync clients can create or remove temporary files while they work. Vault Mirror waits for two matching source scans before planning. If a source file changes after confirmation, it re-scans and asks for confirmation again. If the source remains unstable, wait for the sync client to finish and run Vault Mirror again.

## Backups

Keep a separate backup of both Vaults. A mirror is useful for propagation, not version history or recovery from accidental source-side deletions.
