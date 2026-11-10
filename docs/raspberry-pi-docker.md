# Deploy StoTrak on a Raspberry Pi

Use 64-bit Raspberry Pi OS or another 64-bit Linux OS, with Docker Engine, the Docker Compose plugin and Git installed. The image builds natively for the Pi's ARM64 processor; Node does not need to be installed on the Pi host. Check prerequisites:

```sh
uname -m
docker version
docker compose version
git --version
```

`uname -m` should show `aarch64`. This deployment targets ARM64, not 32-bit Raspberry Pi OS. Docker installation instructions: https://docs.docker.com/engine/install/debian/

## First deployment

The GitHub repository is private. Authenticate Git on the Pi using your existing GitHub SSH setup (or clone with GitHub CLI after `gh auth login`). GitHub credentials stay on the host, outside the app image and Compose file.

```sh
git clone git@github.com:blue-plum/StoTrak.git
cd StoTrak
cp .env.example .env
nano .env
```

Set `PUBLIC_URL` to the Pi's stable LAN address, for example `http://192.168.1.50:8080`. Reserve that IP in your router before printing labels. Change `STOTRAK_PORT` if port 8080 is already occupied; use the same port in `PUBLIC_URL`.

```sh
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 storage-tracker
```

Open `http://PI-IP:8080` on a phone or desktop on the same network. The container restarts automatically when Docker starts. If Docker requires elevated permissions on your installation, prefix Docker commands with `sudo`.

The initial build downloads dependencies and can take several minutes on a Pi. The health check reports readiness; it does not automatically restart an unhealthy but still running process. Unexpected process exits are restarted by Compose's restart policy.

## Update from GitHub

From the same clone directory:

```sh
git pull --ff-only
docker compose up -d --build
docker compose ps
```

Compose rebuilds from the checked-out GitHub source. This does not depend on a pre-published Docker Hub or GHCR image. Use `git checkout v1.0.2` before building if you want the fixed release instead of the latest branch. Back up data before updating; changing source versions does not reverse database changes.

## Persistent data and backups

The `storage-data` named volume contains the SQLite database and photos. Keep this clone in the same directory so Compose uses the same project and volume. A fresh container starts with its own database; existing data from a Windows/manual install is not automatically imported.

To make a consistent backup without installing Node on the host:

```sh
mkdir -p backups
docker compose stop storage-tracker
docker compose run --rm --no-deps --user root --volume "$PWD/backups:/backup" storage-tracker sh -c 'tar -czf /backup/stotrak-data.tar.gz -C /app/data .'
docker compose start storage-tracker
```

Copy `backups/stotrak-data.tar.gz` somewhere safe. This command replaces that backup filename on each run. To restore, stop the app and restore the archive into its named volume with ownership matching the container's `node` user. Keep the current data backed up before restoring.

`docker compose down` stops and removes containers while preserving the data volume. **Do not use `docker compose down -v`** unless you intend to delete the database and photos.

The app currently has no accounts and is intended for a trusted household LAN. Do not expose the port directly to the internet.

## Verification limits

Automated app checks run separately using temporary data. This configuration still needs a live Docker build and camera/QR scan test on your Pi; creating these files does not establish hardware validation.
