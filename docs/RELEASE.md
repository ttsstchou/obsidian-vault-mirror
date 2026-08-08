# Release guide

This project is prepared for the Obsidian Community directory.

## Before the first public release

1. Set a real display name in `manifest.json` and `package.json` `author` fields.
2. Create a public GitHub repository and add it as this repository's `origin` remote.
3. Confirm that the `vault-mirror` plugin ID remains unique in the Obsidian Community directory.
4. Run `pnpm test` and `pnpm build`.
5. Review the safety and privacy documentation.

## Create a release

1. Update `manifest.json`, `package.json`, `versions.json`, and `CHANGELOG.md` to the same semantic version, such as `0.1.0`.
2. Commit and push the source code to the repository's default branch.
3. Create a GitHub Release whose tag exactly matches `manifest.json`'s version. Do not add a `v` prefix.
4. Attach these built files to the release:
   - `main.js`
   - `manifest.json`
   - `styles.css`

## Submit to Obsidian Community

1. Sign in to [Obsidian Community](https://community.obsidian.md) with an Obsidian account.
2. Link the GitHub account that owns the repository.
3. Select **Plugins → New plugin** and submit the public repository URL.
4. Agree to the developer policies and complete the automated review feedback.

The Community directory reads the manifest and README from the repository default branch and downloads installable assets from the matching GitHub Release.
