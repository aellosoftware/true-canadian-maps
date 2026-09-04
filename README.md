# True Canadian Maps

Style, add locations, publish and embed public interactive maps. An Aello Software
product built with MapLibre, PMTiles, Next.js, PostgreSQL/PostGIS and a background
publisher.

This is a founding preview. Published map files, including older releases, are
public. Browser-origin restrictions do not make their contents confidential.

## Install on Linux x64

Download a versioned installer and verify `SHA256SUMS` from the
[releases page](https://github.com/aellosoftware/true-canadian-maps/releases).
Read [Self-hosting](docs/SELF_HOSTING.md) before starting. ARM64 and disconnected
installation are not supported by this release.

## Build from source

Requires Linux x64, Docker Engine/Compose v2 and internet access. The source
archive includes all application build and installer files. Map data and fonts
are downloaded separately under their own licences.

```sh
revision=$(cat SOURCE_REVISION)
for target in app worker delivery marketing; do
  docker build --platform linux/amd64 --build-arg TCM_VERSION="$revision" \
    --target "$target" -f deploy/Dockerfile -t "tcm-$target:local" .
done
```

For source development, install Node.js 22.12 or newer and the pinned pnpm version
in `package.json`, then run:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @tcm/icons build:manifest
pnpm typecheck
pnpm lint
pnpm test
```

Browser journey tests require the dedicated disposable environment on local port
16054. Never point database-resetting test helpers at a production database.

## Browser SDK

The independent MIT browser package is in [packages/embed](packages/embed).
It can be built and packed locally. The script embed supplied by your installation
works without npm. npm distribution remains gated on verified publisher ownership;
do not assume the package is available in the public registry.

## Source and licences

Server and Studio: AGPL-3.0-only. Standalone browser SDK: MIT. See
[licensing](LICENSING.md) and [third-party notices](THIRD_PARTY_NOTICES.md).
`SOURCE_REVISION` and `SOURCE_MANIFEST.json` identify the canonical revision and
the SHA-256 of each exported file. This repository contains reviewed source
snapshots without private development history or runtime data.

Security reports: security@aellosoftware.com. Privacy: privacy@aellosoftware.com.
Legal: legal@aellosoftware.com. Pilot opportunities: opportunities@aellosoftware.com.
Use each contact for its stated purpose; these are not general product-support inboxes.
