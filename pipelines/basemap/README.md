# Basemap pipeline

Produces the shared vector basemap (PMTiles) plus fonts and sprites served from the
delivery plane. Works identically for the hosted service and self-hosted installs.

Source: Protomaps daily planet builds (`https://build.protomaps.com/YYYYMMDD.pmtiles`,
OpenStreetMap data, ODbL). Only the bytes inside the bounding box are downloaded.

```bash
./fetch-latest.sh                       # prints the newest available build date
./fetch-assets.sh  $DELIVERY_ROOT       # Noto Sans glyphs + basemap sprites (OFL / MIT)
./extract.sh 20260901 $DELIVERY_ROOT    # Canada, full zoom (10–20 GB, run on the server)
./extract.sh 20260901 $DELIVERY_ROOT --maxzoom=10 --suffix=-z10   # smaller dev build
pnpm --filter @tcm/pipeline-basemap register -- --name base-ca-20260901 --file $DELIVERY_ROOT/base/base-ca-20260901.pmtiles --build 20260901
```

Environment: `BBOX` (default Canada `-141.01,41.67,-52.58,83.14`), `REGION` (default `ca`).
Cadence: monthly. Old versions stay until no release references them.
