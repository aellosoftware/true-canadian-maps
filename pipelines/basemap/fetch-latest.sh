#!/usr/bin/env bash
# Print the newest Protomaps daily build date that exists (probes today backwards).
set -euo pipefail
for i in 0 1 2 3 4 5 6; do
  d=$(date -u -d "-$i day" +%Y%m%d)
  if curl -sfI "https://build.protomaps.com/$d.pmtiles" >/dev/null; then echo "$d"; exit 0; fi
done
echo "no build found in the last week" >&2; exit 1
