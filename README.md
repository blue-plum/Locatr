# Locatr

**Where everything belongs.**

Current version: **1.2.0**. See [CHANGELOG.md](CHANGELOG.md) for release history.

The header menu contains Manage Lists, Labels, Import Database and Export Database. Import/export transfer JSON inventory records, including their IDs and photo references, but do not include photo files. Import requires confirmation and replaces existing records; invalid imports roll back. Use a full data-volume backup to transfer or restore photos as well.

The app was previously called StoTrak. The GitHub repository, Compose service, image name, `STOTRAK_PORT` setting and data volume retain their existing names so Arcane can redeploy in place. Keep the same Arcane project and volume. Existing QR links and data formats are unchanged.

## Project layout and version control

- `public/` — browser app, styling and logo.
- `server.js`, `package.json`, `package-lock.json` — server and locked dependencies.
- `deploy/` — Linux systemd service configuration.
- `test/` — automated integration checks using temporary data.
- `scripts/` — release packaging command.
- `docs/previews/` — reference screenshots (historical, not live app state).
- `releases/` — generated versioned ZIP files; the previous unversioned ZIP is preserved in `releases/archive/`.
- `data/` — private local database and photos; excluded from Git and release packages.
- `node_modules/`, `.npm-cache/` — local dependencies and cache; excluded from Git.

Git tags identify release snapshots: `v1.0.0` is the original working baseline; `v1.0.1` contains the folder and release workflow cleanup. Commits use the local automation identity `Codex <codex@localhost>`; no personal Git identity was configured. The private GitHub repository is [blue-plum/Locatr](https://github.com/blue-plum/Locatr), configured locally as `origin`. Push committed changes with `git push` and new release tags with `git push origin --tags`. Git history does not back up your inventory data.

Inspect changes with `git status`, `git diff` and `git log --oneline --decorate`. For future changes, create a branch such as `git switch -c codex/my-change`, run the checks, then commit the source changes.

To build a release on Windows with PowerShell:

```sh
npm run build:release
```

This runs the tests and creates `releases/StoTrak-1.0.1.zip` using the version in `package.json`. Rebuilding that version replaces its generated ZIP. Data, installed dependencies and caches are never included. For the next release, update the changelog, run `npm version patch --no-git-tag-version`, build, commit and tag the matching version.

A responsive household inventory for a headless Raspberry Pi or Linux server. Browse at `http://PI-IP:8080` from phones, tablets and computers on your home network.

## Included

- Custom room and storage-type lists, with familiar defaults.
- Delete unused locations and storage types from Manage lists after confirmation. Entries used by storage cannot be deleted; reassign that storage first. Deleted defaults stay deleted after a restart.
- Storage containers with a room, type, precise position, notes and location photo.
- Items with photos, descriptions, search keywords and quantity; edit and move items between containers.
- Storage, room and item views, text search and filters.
- Permanent container IDs and QR codes that open the container and its contents.
- Download custom QR labels as SVG or 300 DPI PNG, with three editable text lines alongside the code. Labels are 100 × 40 mm; SVG QR modules are vector squares. SVG text must be converted to outlines in your design tool for CAD extrusion; this is not an STL export. Preserve the QR quiet border, avoid stretching the code and test scan the final printed or fabricated result.
- A4 label sheets for Avery L7160/J8160 (21 labels) and L7163/J8163 (14 labels), with a starting offset for partly used sheets.
- Local SQLite database and resized JPEG photographs. No cloud service or subscription.
- Record export as JSON. Full backups also require the photo directory.

## Run on Linux / Raspberry Pi

Use a 64-bit Raspberry Pi OS or Linux installation and Node.js 24 LTS (minimum 22.13). Check `node --version` before starting. Copy this project onto the server.

```sh
cd storage-tracker
npm ci --omit=dev
npm start
```

Open `http://PI-IP:8080`. `hostname -I` on the Pi shows its IP addresses. The service listens on all interfaces. If a firewall is enabled, allow TCP 8080 from your home network.

### Start automatically with systemd

Install the source under `/opt/storage-tracker` and dependencies with `npm ci --omit=dev`. The supplied unit assumes Node is at `/usr/bin/node`; check `command -v node` and adjust `ExecStart` if necessary.

```sh
sudo useradd --system --home /var/lib/storage-tracker --shell /usr/sbin/nologin storage-tracker
sudo cp deploy/storage-tracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now storage-tracker
sudo systemctl status storage-tracker
```

The app files must be readable by the service user. The systemd unit creates and owns `/var/lib/storage-tracker` for persistent data. View logs with `journalctl -u storage-tracker`.

### Docker alternative

For a headless Raspberry Pi, follow the [GitHub and Docker Compose deployment guide](docs/raspberry-pi-docker.md). Copy `.env.example` to `.env` and set the Pi address before printing labels.

With Docker Engine and the Compose plugin installed:

```sh
docker compose up -d --build
```

The named volume holds records and photographs across container updates. Do not remove the volume when upgrading.

## QR labels and stable addresses

Reserve the Pi’s IP in your router before printing. By default codes use the address through which you access the app. Set `PUBLIC_URL=http://PI-IP:8080` in the service environment or Compose configuration to fix the printed destination. Restart after changing it. Existing paper labels retain the original URL; changing the server address may require reprinting them. Container name, room and contents can change without changing its ID or QR link.

Choose the label format and containers, then print from the generated sheet. Select A4, 100% scale / actual size, no headers or footers. Test on plain paper and compare against your label stock. Other Avery formats are not interchangeable; physical printer alignment has not been verified.

Label dimensions follow the official [L7160](https://www.avery.co.uk/template-l7160) and [L7163](https://www.avery.co.uk/template-l7163) templates. Phone camera input uses the standard HTML [capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture).

## Family workflow

1. Add any extra rooms or types in **Manage lists**.
2. Add a box or drawer; photograph it where it lives and enter its exact position.
3. Open that storage and add items with photos and useful keywords.
4. Print and attach a QR label. Scan with your phone’s normal camera app to open the storage page.
5. Search later under Items, Storage or Locations. Use **Edit / move** when reorganising.

Phone photo inputs request the outward-facing camera using `capture="environment"`. Depending on the phone and browser, you may see a camera or a photo picker. Existing images can also be uploaded from a computer. This app does not require `getUserMedia` or a live camera stream. HEIC support depends on the installed image decoder; if an upload fails, use JPEG/PNG or change your phone’s photo format. Photos are limited to 15 MB, rotated, resized to 1600 pixels and converted to JPEG; original uploads are not retained.

## Access and backups

This initial version is for a trusted household LAN: everyone who can reach the app can view and edit it. It has no user accounts. Do not port-forward it onto the internet. For remote access use a private VPN; add authentication and HTTPS before exposing it more broadly.

For a full backup, stop the service and copy the entire data directory (database and photos), then restart. For systemd:

```sh
sudo systemctl stop storage-tracker
sudo tar -czf storage-backup.tar.gz -C /var/lib storage-tracker
sudo systemctl start storage-tracker
```

Restore the directory with the service stopped and ensure ownership is `storage-tracker:storage-tracker`. For a manual launch the data directory defaults to `./data` beside `server.js`. Docker uses the named volume instead; stop the container and back up that volume. JSON export can be imported through the header menu but is not a full backup because it contains no photo files. Replaced and removed photos remain in the photo folder so no automated cleanup destroys them.

## Development and checks

```sh
npm ci
npm test
npm start
```

`PORT`, `DATA_DIR` and `PUBLIC_URL` are configurable environment variables. No demo records are inserted. Tests use a separate temporary directory and exercise real HTTP requests and database persistence. Physical phone capture, Raspberry Pi deployment and label-printer alignment still require testing on your devices.
