# Releasing

Releases are built by GitHub Actions (`.github/workflows/release.yml`) and published as GitHub
Releases. Installed apps check the latest published release for updates.

## Cut a release

1. Bump the version in `apps/desktop/package.json`:

   ```sh
   pnpm --filter @dawnstudio/desktop exec npm version 0.2.0 --no-git-tag-version
   ```

2. Commit, tag and push. The tag must be `v` + that version:

   ```sh
   git commit -am "Release 0.2.0"
   git tag v0.2.0
   git push && git push origin v0.2.0
   ```

3. The workflow checks the code, creates a **draft** release with generated notes, and uploads
   the builds from three runners. When all three jobs are green, open the draft on GitHub,
   edit the notes, and **Publish**. Installed apps notice within a few hours (or right away
   via _Check for Updates…_).

## What gets built

| Platform                  | Files                                    | Updates                                          |
| ------------------------- | ---------------------------------------- | ------------------------------------------------ |
| macOS, Apple silicon      | `Invoicing-<v>-mac-arm64.dmg` (+ `.zip`) | "Update available" → download page               |
| macOS, Intel              | `Invoicing-<v>-mac-x64.dmg` (+ `.zip`)   | "Update available" → download page               |
| Windows x64               | `Invoicing-<v>-windows-setup.exe`        | Downloads in the background, installs on restart |
| Linux x64                 | `Invoicing-<v>-linux-x86_64.AppImage`    | Downloads in the background, installs on restart |
| Linux x64 (Debian/Ubuntu) | `invoicing_<v>_amd64.deb`                | "Update available" → download page               |

The `latest*.yml` and `.blockmap` files in the release are what the app reads to find and
download updates; leave them in place.

## Unsigned builds

There's no Apple Developer ID or Windows code-signing certificate yet, so:

- **macOS**: the app is ad-hoc signed and not notarized. The first launch is blocked; right-click
  the app → **Open** → **Open** (or System Settings → Privacy & Security → **Open Anyway**).
  macOS won't let an unsigned app replace itself, so updates are a new download dragged into
  Applications. Data lives in `~/Library/Application Support/Invoicing` and is kept.
- **Windows**: SmartScreen warns about an unknown publisher: **More info** → **Run anyway**.
- **Linux**: make the AppImage executable (`chmod +x`), or install the `.deb` with
  `sudo apt install ./invoicing_<v>_amd64.deb`.

Signing and notarization (and with them, automatic updates on macOS) are planned; see E11 in
`docs/epics.md`.

## Building locally

```sh
pnpm build
pnpm package:mac      # or package:win / package:linux
```

Output goes to `apps/desktop/release/`. Local builds carry no update settings, so they never
check for updates. The `.deb` needs a homepage; pass
`-c.extraMetadata.homepage=<url>` when building it locally.

## Trying updates in development

Create `apps/desktop/dev-app-update.yml` (git-ignored) naming a repository with published
releases:

```yaml
provider: github
owner: <owner>
repo: <repo>
```

`pnpm dev:desktop` then checks that repository like an installed app would (against the
version in `apps/desktop/package.json`). Delete the file to turn it off.

## Changelog on the website

Add `apps/web/src/content/changelog/<version>.md` for each release (copy the latest one).
Leave `date` out while it's being prepared (shown as "Coming soon"), and set it when you
publish.
