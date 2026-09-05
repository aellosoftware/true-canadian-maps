# Self-hosting: Linux x64 preview

Run Studio, PostgreSQL/PostGIS, the publisher and map-file delivery on your own
Linux x64 server. Public map files are downloadable; origin restrictions only
limit API discovery. This release does not promise ARM64 or disconnected support.

## Prerequisites

- Linux x86_64, Docker Engine with Compose v2, Bash, OpenSSL, curl and tar.
- Start with 4 CPUs, 8 GB RAM and 40 GB free disk for the applications and a small
  overview extract. Reserve additional space for image upgrades and backups.
  Basemap disk and download sizes depend strongly on region and maximum zoom;
  detailed national extracts can require tens of gigabytes. Measure your extract.
- Internet access to GHCR, GitHub and Protomaps during installation; DNS and ports
  80/443 for optional Caddy HTTPS. Keep the database off the public network.
- Optional verified SMTP sender/provider for invitations and recovery.

## Install

Download the Linux x64 installer and `SHA256SUMS` from
https://github.com/aellosoftware/true-canadian-maps/releases. Verify the archive's
matching checksum line with `sha256sum -c` before extracting it. Keep the version
pinned in `.env`; do not use `latest`.

```sh
tar -xzf true-canadian-maps-0.2.1-linux-x64.tar.gz
cd true-canadian-maps-0.2.1-linux-x64
./install.sh configure
$EDITOR .env
./install.sh start
```

Set real `STUDIO_HOST`, `PUBLIC_STUDIO_URL`, `PUBLIC_API_URL`, `PUBLIC_MAPS_URL`
and `ACME_EMAIL`. Configure generates random secrets in a mode-600 `.env` and
never displays them. Single-host mode serves map files under `/maps`; Studio's
API lives under `/api`. For a separate map-files domain, use `Caddyfile.multi`
and set `MAPS_HOST`, `CADDY_CONFIG` and `PUBLIC_MAPS_URL` as shown in `.env.example`.

Start performs this order: database healthy → migrate → seed → import/register
basemap and assets → delivery → application and worker. Default zoom 8 is an
overview map; increase the zoom only after checking resource needs. Set
`BASEMAP_BUILD` to an available YYYYMMDD Protomaps build for repeatable extraction.
The imported archive and existing publication files are preserved on reruns.

Studio initially binds to server loopback. Create the first administrator from
the server's private terminal:

```sh
./install.sh setup
```

Enter the name, email, organization and a password of at least 10 characters.
The password is hidden and passed through standard input, not command arguments.
The first-run page closes after the first account is created.
Then run `./install.sh expose` to validate Caddy and enable public HTTPS. The
installer refuses exposure until setup is complete. An existing reverse proxy
can replace Caddy; preserve Range and CORS headers on map-file responses.

## Verify

- Studio `/api/healthz` succeeds; app and worker are healthy in `docker compose ps`.
- Gallery previews load with fonts and the v4 basemap sprites.
- Create a map, edit/import public sample locations, save, publish, embed it on a
  second origin, export it and restore a previous release.
- A `Range: bytes=0-126` request for the registered `.pmtiles` file returns 206
  and exactly 127 bytes. Keep attribution visible in both Studio and embeds.
- Sign out and sign in. If recovery is enabled, complete an actual email reset.

SMTP does not automatically enable email verification. See ACCOUNT_RECOVERY.md:
`PASSWORD_RECOVERY_ENABLED` and `REQUIRE_EMAIL_VERIFICATION` are independent and
default to false. Mail links and message bodies must never be logged.

## Backup and restore

```sh
./backup.sh /private-backups/tcm-before-upgrade
```

The backup briefly stops application writes and includes the database, artifacts,
basemap, fonts, sprites, image references and protected configuration, with
checksums. Keep it private and encrypted off-server. Basemap and font versions
must be retained: published maps refer to their original files.

Prefer a restore drill in a separate Compose project with separate ports and
volumes. Configure its `.env`, preserving necessary secrets from `runtime.env`
without reusing production ports, then run:

```sh
./restore.sh /private-backups/tcm-before-upgrade --replace-existing
```

This explicitly replaces the selected Compose installation's database and named
data volumes. Never point the drill at production. Verify accounts, map counts,
published files and byte ranges afterward. Keep the existing server available
until the restored installation passes checks. See UPGRADING.md for upgrades
and rollback.

## Network and licensing

Installation downloads upstream images, fonts, sprites and basemap data. HTTPS
uses your certificate provider; email uses your SMTP provider. Map browsers fetch
the configured public URLs and any external marker images/links you add. Review
those destinations for your installation. No offline operation claim is made.

Server/Studio: AGPL-3.0-only. Browser SDK: MIT. Corresponding source is available
through Studio's source links and the public release. Preserve LICENSE,
LICENSING.md, browser notices, map attribution and `/fonts/OFL.txt`. Dependency
licences are retained in images under `/usr/share/licenses/true-canadian-maps/`.
