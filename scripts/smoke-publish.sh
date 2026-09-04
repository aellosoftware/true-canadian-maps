#!/usr/bin/env bash
# Publishes a project end-to-end against the local dev stack (studio :3000, delivery :8081, worker running).
set -euo pipefail
B=${BASE_URL:-http://127.0.0.1:16054}; M=${MAPS_URL:-http://127.0.0.1:18054}
[[ ${TCM_DISPOSABLE_E2E:-} == true && $B =~ ^http://(127\.0\.0\.1|localhost):16054$ && $M =~ ^http://(127\.0\.0\.1|localhost):18054$ ]] || { echo 'Publishing smoke tests require the dedicated disposable installation.' >&2; exit 2; }
SP=$(mktemp -d); J=$SP/c.txt; fail=0
py() { python3 -c "import json,sys;d=json.load(sys.stdin);$1"; }
check() { if [ "$1" = "$2" ]; then echo "  ok   $3"; else echo "  FAIL $3 (got '$1', want '$2')"; fail=1; fi; }
curl -s -c $J -o /dev/null -X POST $B/api/auth/sign-in/email -H 'content-type: application/json' -H "origin: $B" -d '{"email":"ada@example.com","password":"correct-horse-battery"}'
ORG=$(curl -s -b $J $B/api/v1/me | py 'print(d["organizations"][0]["organizationId"])')
PRJ=$(curl -s -b $J -X POST $B/api/v1/orgs/$ORG/projects -H 'content-type: application/json' -d '{"name":"Publish Smoke","presetSlug":"true-north"}' | py 'print(d["project"]["id"])')
curl -s -b $J -o /dev/null -X POST $B/api/v1/orgs/$ORG/projects/$PRJ/markers/bulk -H 'content-type: application/json' -d '{"markers":[{"title":"Toronto","lat":43.65,"lng":-79.38,"icon":"maki:cafe","color":"#E23B3B"},{"title":"Ottawa","lat":45.42,"lng":-75.69,"color":"#102D3C"}]}'
echo "== publish"
REL=$(curl -s -b $J -X POST $B/api/v1/orgs/$ORG/projects/$PRJ/publish -H 'content-type: application/json' -d '{}' | py 'print(d["release"]["id"])')
check "$(curl -s -b $J -o /dev/null -w '%{http_code}' -X POST $B/api/v1/orgs/$ORG/projects/$PRJ/publish -H 'content-type: application/json' -d '{}')" "409" "second publish while building is rejected"
ST=""; for i in $(seq 1 30); do sleep 1; ST=$(curl -s -b $J $B/api/v1/orgs/$ORG/projects/$PRJ/releases/$REL | py 'r=d["release"];print(r["status"]+" "+str(r.get("error") or ""))'); case "$ST" in published*|failed*) break;; esac; done
check "${ST%% *}" "published" "release #1 published (${i}s) ${ST#published}"
echo "== artifacts"
check "$(curl -s $M/p/$PRJ/production.json | py 'print(d["release_id"])')" "$REL" "pointer points at release"
check "$(curl -s $M/t/$ORG/$PRJ/$REL/style.json | py 'print(len(d["layers"])>60 and d["sprite"][1]["id"]=="markers" and d["sources"]["basemap"]["url"].startswith("pmtiles://"))')" "True" "style.json valid"
check "$(curl -s $M/t/$ORG/$PRJ/$REL/markers.geojson | py 'print(len(d["features"]))')" "2" "markers.geojson has 2 features"
check "$(curl -s $M/t/$ORG/$PRJ/$REL/sprite.json | py 'print("pin__maki-cafe__e23b3b" in d and "pin__pin__102d3c" in d)')" "True" "sprite index has marker images"
check "$(curl -s -o /dev/null -w '%{http_code}' $M/t/$ORG/$PRJ/$REL/sprite@2x.png)" "200" "sprite@2x.png served"
check "$(curl -s $M/t/$ORG/$PRJ/$REL/manifest.json | py 'print(d["schema"], d["marker_count"])')" "tcm.release/1 2" "manifest"
check "$(curl -s -o /dev/null -w '%{http_code}' -H 'Range: bytes=0-511' $M/base/base-ca-20260901-z8.pmtiles)" "206" "basemap range request"
echo "== second publish + rollback"
REL2=$(curl -s -b $J -X POST $B/api/v1/orgs/$ORG/projects/$PRJ/publish -H 'content-type: application/json' -d '{}' | py 'print(d["release"]["id"])')
for i in $(seq 1 30); do sleep 1; ST=$(curl -s -b $J $B/api/v1/orgs/$ORG/projects/$PRJ/releases/$REL2 | py 'print(d["release"]["status"])'); case "$ST" in published|failed) break;; esac; done
check "$ST" "published" "release #2 published"
check "$(curl -s $M/p/$PRJ/production.json | py 'print(d["release_id"])')" "$REL2" "pointer moved to release #2"
check "$(curl -s -b $J $B/api/v1/orgs/$ORG/projects/$PRJ/releases/$REL | py 'print(d["release"]["status"])')" "superseded" "release #1 superseded"
curl -s -b $J -o /dev/null -X POST $B/api/v1/orgs/$ORG/projects/$PRJ/environments/production/rollback -H 'content-type: application/json' -d "{\"releaseId\":\"$REL\"}"; sleep 3
check "$(curl -s $M/p/$PRJ/production.json | py 'print(d["release_id"])')" "$REL" "rollback rewrote pointer to release #1"
check "$(curl -s -b $J $B/api/v1/orgs/$ORG/projects/$PRJ/releases | py 'print(",".join(str(r["number"])+":"+r["status"] for r in d["releases"]))')" "2:superseded,1:published" "release statuses after rollback"
echo "== embed config"
KEY=$(curl -s -b $J -X POST $B/api/v1/orgs/$ORG/projects/$PRJ/keys -H 'content-type: application/json' -d '{"label":"Website","allowedOrigins":["https://example.com","http://localhost:*"]}' | py 'print(d["key"]["publicKey"])')
check "$(curl -s -o /dev/null -w '%{http_code}' -H 'origin: https://example.com' "$B/api/v1/embed/config?project=$PRJ&key=$KEY")" "200" "allowed origin gets config"
check "$(curl -s -H 'origin: https://example.com' "$B/api/v1/embed/config?project=$PRJ&key=$KEY" | py 'print(d["releaseId"]==sys.argv[1] if False else d["markerCount"])')" "2" "config carries marker count"
check "$(curl -s -o /dev/null -w '%{http_code}' -H 'origin: https://evil.example' "$B/api/v1/embed/config?project=$PRJ&key=$KEY")" "403" "foreign origin rejected"
check "$(curl -s -o /dev/null -w '%{http_code}' "$B/api/v1/embed/config?project=$PRJ&key=$KEY")" "403" "missing origin rejected"
check "$(curl -s -o /dev/null -w '%{http_code}' -H 'origin: https://example.com' "$B/api/v1/embed/config?project=$PRJ&key=pk_live_00000000000000000000000000000000")" "403" "unknown key rejected"
check "$(curl -s -D - -o /dev/null -H 'origin: https://example.com' "$B/api/v1/embed/config?project=$PRJ&key=$KEY" | grep -i '^access-control-allow-origin' | tr -d '\r' | cut -d' ' -f2)" "https://example.com" "CORS header echoes origin"
echo "PRJ=$PRJ ORG=$ORG KEY=$KEY REL=$REL" > /tmp/claude-1000/-home-lowc-workspaces-truecanadamaps-com/ecc55c54-2a89-4244-969d-74e1f18b77a5/scratchpad/publish-ids.env 2>/dev/null || true
rm -rf $SP; [ $fail = 0 ] && echo "ALL OK" || { echo "FAILURES"; exit 1; }
