#!/usr/bin/env bash
# Extract a regional PMTiles archive from a Protomaps planet build.
# usage: extract.sh <BUILD_DATE> <DELIVERY_ROOT> [--maxzoom=N] [--suffix=-zN]
set -euo pipefail
BUILD=${1:?build date YYYYMMDD}; ROOT=${2:?delivery root}; shift 2
MAXZOOM=""; SUFFIX=""
for a in "$@"; do case $a in --maxzoom=*) MAXZOOM="--maxzoom=${a#*=}";; --suffix=*) SUFFIX="${a#*=}";; esac; done
BBOX=${BBOX:--141.01,41.67,-52.58,83.14}
REGION=${REGION:-ca}
NAME="base-${REGION}-${BUILD}${SUFFIX}"
OUT="$ROOT/base/$NAME.pmtiles"
mkdir -p "$ROOT/base"
if ! command -v pmtiles >/dev/null; then echo "pmtiles CLI missing: https://github.com/protomaps/go-pmtiles/releases" >&2; exit 1; fi
echo "extracting $NAME (bbox $BBOX ${MAXZOOM:-full zoom})"
pmtiles extract "https://build.protomaps.com/$BUILD.pmtiles" "$OUT.tmp" --bbox="$BBOX" $MAXZOOM --download-threads="${THREADS:-8}"
mv "$OUT.tmp" "$OUT"
pmtiles verify "$OUT"
( cd "$ROOT/base" && sha256sum "$NAME.pmtiles" > "$NAME.pmtiles.sha256" )
pmtiles show "$OUT" | head -20
echo "done: $OUT"
