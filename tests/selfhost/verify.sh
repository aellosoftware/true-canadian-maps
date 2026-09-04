#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ ${TCM_DISPOSABLE_INSTALL:-} == true && ${GITHUB_ACTIONS:-} == true ]] || { echo 'Requires an explicitly disposable GitHub runner.' >&2; exit 2; }
[[ ${RELEASE_VERSION:-} =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][a-zA-Z0-9.-]+)?$ ]] || exit 2
repo=$(pwd)
work=$(mktemp -d)
gh release download "v$RELEASE_VERSION" --dir "$work/release"
(cd "$work/release" && sha256sum -c SHA256SUMS)
mkdir "$work/install" "$work/evidence"
tar -xzf "$work/release/true-canadian-maps-$RELEASE_VERSION-linux-x64.tar.gz" -C "$work/install" --strip-components=1
cd "$work/install"
./install.sh configure
python3 - <<'PY'
from pathlib import Path
import os
p=Path('.env')
changes={'TCM_VERSION':os.environ['RELEASE_VERSION'],'STUDIO_HOST':'127.0.0.1','PUBLIC_STUDIO_URL':'http://127.0.0.1:16062','PUBLIC_API_URL':'http://127.0.0.1:16062/api','PUBLIC_MAPS_URL':'http://127.0.0.1:18062','APP_PORT':'16062','DELIVERY_PORT':'18062','BASEMAP_MAXZOOM':'2','BASEMAP_BUILD':'20260901'}
lines=[k+'='+changes[k] if '=' in line and (k:=line.split('=',1)[0]) in changes else line for line in p.read_text().splitlines()]
lines+=['COMPOSE_PROJECT_NAME=tcm-install-validation-'+os.environ['GITHUB_RUN_ID']]
p.write_text('\n'.join(lines)+'\n')
PY
./install.sh start </dev/null
printf 'Installation test\nadmin@example.test\nDisposable validation\nDisposable-map-test-2026!\n' | ./install.sh setup
for path in '/fonts/Noto%20Sans%20Regular/0-255.pbf' /fonts/OFL.txt /sprites/basemap/v4/light.json; do curl -fsS -o /dev/null "http://127.0.0.1:18062$path"; done
curl -fsS -D "$work/range.headers" -H 'Range: bytes=0-126' http://127.0.0.1:18062/base/base-ca-20260901-z2.pmtiles -o "$work/range.bin"
grep -q '206 Partial Content' "$work/range.headers"
test "$(wc -c < "$work/range.bin")" -eq 127
source_revision=$(docker compose exec -T app node -e 'process.stdout.write(process.env.TCM_SOURCE_REVISION)' </dev/null)
curl -fsS "http://127.0.0.1:18062/source/$source_revision.tar.gz" -o "$work/deployed-source.tar.gz"
cmp "$work/deployed-source.tar.gz" "$work/release/true-canadian-maps-$RELEASE_VERSION-source.tar.gz"
export TEST_BASE=http://127.0.0.1:16062 TEST_EVIDENCE="$work/evidence/map.json"
node "$repo/tests/selfhost/map-check.mjs" create
./backup.sh "$work/backup" </dev/null
# Re-running the pinned installer exercises upgrade ordering with existing data.
./install.sh start </dev/null
node "$repo/tests/selfhost/map-check.mjs" check
./restore.sh "$work/backup" --replace-existing </dev/null
node "$repo/tests/selfhost/map-check.mjs" check
docker compose --profile edge run --rm --no-deps edge caddy validate --config /etc/caddy/Caddyfile </dev/null
echo 'Exact release: clean install, source parity, assets, publish, upgrade and restore passed.'
# The hosted runner discards its isolated VM and protected runtime/backup files.
