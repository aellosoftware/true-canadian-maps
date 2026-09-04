#!/bin/sh
set -eu
apk add --no-cache curl tar postgresql16-client >/dev/null
PMV=1.31.2
PMSHA=3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f
ASSETS_REV=028c18f713baecad011301ff7a69acc39bcc2ae7
mkdir -p /out/base
temp=$(mktemp -d /out/base/.tcm-extract.XXXXXX)
trap 'rm -rf "$temp"' EXIT
curl --retry 3 -fsSL "https://github.com/protomaps/go-pmtiles/releases/download/v${PMV}/go-pmtiles_${PMV}_Linux_x86_64.tar.gz" -o "$temp/pmtiles.tgz"
printf '%s  %s\n' "$PMSHA" "$temp/pmtiles.tgz" | sha256sum -c - >/dev/null
tar -xzf "$temp/pmtiles.tgz" -C /usr/local/bin pmtiles
case "$REGION" in ''|*[!a-z0-9-]*) echo 'REGION must use lowercase letters, digits or hyphens' >&2; exit 2;; esac
case "${MAXZOOM:-8}" in [0-9]|1[0-5]) MAXZOOM=${MAXZOOM:-8};; *) echo 'MAXZOOM must be 0-15' >&2; exit 2;; esac
BUILD=${BASEMAP_BUILD:-}
if [ -z "$BUILD" ]; then
  now=$(date -u +%s)
  for i in 0 1 2 3 4 5 6; do
    day=$(date -u -d "@$((now - i * 86400))" +%Y%m%d)
    if curl --retry 2 -sfI "https://build.protomaps.com/$day.pmtiles" >/dev/null; then BUILD=$day; break; fi
  done
fi
case "$BUILD" in ????????) case "$BUILD" in *[!0-9]*) exit 2;; esac;; *) echo 'No daily build found; set BASEMAP_BUILD to an available YYYYMMDD build.' >&2; exit 1;; esac
mkdir -p /out/base /out/fonts /out/sprites/basemap
curl --retry 3 -fsSL "https://github.com/protomaps/basemaps-assets/archive/$ASSETS_REV.tar.gz" -o "$temp/assets.tgz"
tar -xzf "$temp/assets.tgz" -C "$temp"
assets="$temp/basemaps-assets-$ASSETS_REV"
test -f "$assets/fonts/Noto Sans Regular/0-255.pbf"
test -f "$assets/fonts/OFL.txt"
test -f "$assets/sprites/v4/light.json"
# These fixed asset paths are pinned to the reviewed upstream revision. Preserve
# existing bytes; changing assets requires a separately versioned delivery path.
for font in "$assets/fonts/"*; do cp -an "$font" /out/fonts/; done
cp -an "$assets/sprites/v4" /out/sprites/basemap/
test -f '/out/fonts/Noto Sans Regular/0-255.pbf'
test -f /out/fonts/OFL.txt
NAME="base-${REGION}-${BUILD}-z${MAXZOOM}"
file="/out/base/$NAME.pmtiles"
if [ ! -f "$file" ]; then
  echo "Extracting $NAME (bbox $BBOX); download size varies with region and zoom."
  pmtiles extract "https://build.protomaps.com/$BUILD.pmtiles" "$temp/base.pmtiles" --bbox="$BBOX" --maxzoom="$MAXZOOM" --download-threads=8
  pmtiles verify "$temp/base.pmtiles"
  mv "$temp/base.pmtiles" "$file"
fi
pmtiles verify "$file"
chmod 644 "$file"
SHA=$(sha256sum "$file" | cut -d' ' -f1)
SIZE=$(stat -c %s "$file")
ID="bmv_$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n' | tr 'a-f' 'A-F' | head -c 26)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v id="$ID" -v name="$NAME" -v build="$BUILD" -v bbox="[$BBOX]" -v zoom="$MAXZOOM" -v size="$SIZE" -v sha="$SHA" <<'SQL'
INSERT INTO basemap_versions (id, name, pmtiles_path, source_url, source_build_date, tileset_schema, bbox, min_zoom, max_zoom, size_bytes, sha256, status, attribution)
VALUES (:'id', :'name', 'base/' || :'name' || '.pmtiles', 'https://build.protomaps.com/' || :'build' || '.pmtiles', :'build', 4, :'bbox'::jsonb, 0, :'zoom'::integer, :'size'::bigint, :'sha', 'available', '© OpenStreetMap contributors, Protomaps')
ON CONFLICT (name) DO UPDATE SET size_bytes = EXCLUDED.size_bytes, sha256 = EXCLUDED.sha256;
SQL
echo "Registered $NAME ($SIZE bytes). Font licence: /fonts/OFL.txt; map data: OpenStreetMap ODbL."
