#!/usr/bin/env bash
# Dev smoke test for auth + tenancy + projects. Resets local test data.
set -euo pipefail
B=${BASE_URL:-http://127.0.0.1:16054}
PSQL=${PSQL:-psql}
DB=${DATABASE_URL:?Set the dedicated disposable database URL}
export BASE_URL="$B"
python3 - <<'PY'
import os,urllib.parse
db=urllib.parse.urlparse(os.environ['DATABASE_URL'])
app=urllib.parse.urlparse(os.environ['BASE_URL'])
if os.environ.get('TCM_DISPOSABLE_E2E')!='true' or db.hostname not in ['127.0.0.1','localhost','tcm-e2e-db'] or db.path!='/tcm_e2e' or app.hostname not in ['127.0.0.1','localhost'] or app.port!=16054:
    raise SystemExit('Refusing reset: use TCM_DISPOSABLE_E2E=true, tcm_e2e and isolated app port 16054')
PY
SP=$(mktemp -d); J=$SP/cookies.txt
py() { python3 -c "import json,sys;d=json.load(sys.stdin);$1"; }
fail=0; check() { if [ "$1" = "$2" ]; then echo "  ok   $3"; else echo "  FAIL $3 (got '$1', want '$2')"; fail=1; fi; }

"$PSQL" "$DB" -v ON_ERROR_STOP=1 -q -c "DELETE FROM organizations; DELETE FROM users; DELETE FROM verifications;"
echo "== setup"
check "$(curl -s $B/api/v1/setup | py 'print(d["needsSetup"])')" "True" "needsSetup before"
curl -s -c $J -X POST $B/api/v1/setup -H 'content-type: application/json' -d '{"name":"Ada Admin","email":"Ada@Example.com","password":"correct-horse-battery","organizationName":"Northern Trails Co-op"}' > $SP/setup.json
check "$(py 'print(d["organization"]["slug"])' < $SP/setup.json)" "northern-trails-co-op" "setup creates org"
check "$(curl -s $B/api/v1/setup | py 'print(d["needsSetup"])')" "False" "needsSetup after"
check "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/v1/setup -H 'content-type: application/json' -d '{"name":"x","email":"x@example.com","password":"correct-horse-battery","organizationName":"X"}')" "409" "second setup rejected"
echo "== session"
curl -s -b $J $B/api/v1/me > $SP/me.json
check "$(py 'print(d["user"]["email"])' < $SP/me.json)" "ada@example.com" "me (email lower-cased)"
ORG=$(py 'print(d["organizations"][0]["organizationId"])' < $SP/me.json)
check "$(py 'print(d["organizations"][0]["role"])' < $SP/me.json)" "owner" "creator is owner"
check "$(curl -s -o /dev/null -w '%{http_code}' $B/api/v1/me)" "401" "anonymous me 401"
check "$(curl -s -c $SP/c2 -o /dev/null -w '%{http_code}' -X POST $B/api/auth/sign-in/email -H 'content-type: application/json' -H "origin: $B" -d '{"email":"ada@example.com","password":"correct-horse-battery"}')" "200" "sign-in"
check "$(curl -s -b $SP/c2 $B/api/v1/me | py 'print(d["user"]["name"])')" "Ada Admin" "session after sign-in"
echo "== projects"
curl -s -b $J -X POST $B/api/v1/orgs/$ORG/projects -H 'content-type: application/json' -d '{"name":"Store Locator","template":"store_locator"}' > $SP/prj.json
PRJ=$(py 'print(d["project"]["id"])' < $SP/prj.json)
check "$(py 'print(d["project"]["slug"])' < $SP/prj.json)" "store-locator" "create project"
check "$(curl -s -b $J -X POST $B/api/v1/orgs/$ORG/projects -H 'content-type: application/json' -d '{"name":"Store Locator"}' | py 'print(d["project"]["slug"])')" "store-locator-2" "duplicate name gets suffix"
check "$(curl -s -b $J -o /dev/null -w '%{http_code}' -X POST $B/api/v1/orgs/$ORG/projects -H 'content-type: application/json' -d '{"name":""}')" "422" "validation error"
check "$(curl -s -b $J -X PATCH $B/api/v1/orgs/$ORG/projects/$PRJ -H 'content-type: application/json' -d '{"description":"All our branches"}' | py 'print(d["project"]["description"])')" "All our branches" "patch project"
check "$(curl -s -b $J $B/api/v1/orgs/$ORG/projects | py 'print(len(d["projects"]))')" "2" "list projects"
check "$($PSQL "$DB" -tA -c "select (select count(*) from project_environments)||'/'||(select count(*) from styles)")" "4/2" "environments + styles created"
check "$(curl -s -b $J "$B/api/v1/orgs/$ORG/audit?limit=10" | py 'print(",".join(sorted(set(e["action"] for e in d["events"]))))')" "installation.setup,project.create,project.update" "audit trail"
check "$(curl -s -b $J -o /dev/null -w '%{http_code}' $B/api/v1/orgs/org_01ARZ3NDEKTSV4RRFFQ69G5FAV/projects)" "404" "foreign org hidden"
check "$(curl -s -b $J -o /dev/null -w '%{http_code}' -X DELETE $B/api/v1/orgs/$ORG/projects/$PRJ)" "204" "delete project"
echo "== second user / tenancy"
check "$(curl -s -c $SP/c3 -o /dev/null -w '%{http_code}' -X POST $B/api/auth/sign-up/email -H 'content-type: application/json' -H "origin: $B" -d '{"name":"Bob","email":"bob@example.com","password":"another-strong-passphrase"}')" "200" "second user signs up (ALLOW_SIGNUP)"
check "$(curl -s -b $SP/c3 -o /dev/null -w '%{http_code}' $B/api/v1/orgs/$ORG/projects)" "404" "non-member cannot see org"
check "$(curl -s -b $SP/c3 -X POST $B/api/v1/orgs -H 'content-type: application/json' -d '{"name":"Bob Maps"}' | py 'print(d["organization"]["slug"])')" "bob-maps" "second user creates own org"
echo "== pages"
check "$(curl -s -o /dev/null -w '%{http_code}' $B/login)" "200" "/login"
check "$(curl -s -o /dev/null -w '%{redirect_url}' $B/setup)" "$B/login" "/setup redirects once configured"
check "$(curl -s -b $J -o /dev/null -w '%{http_code}' $B/o/northern-trails-co-op)" "200" "dashboard renders"
check "$(curl -s -b $J -o /dev/null -w '%{http_code}' $B/o/bob-maps)" "404" "other org dashboard 404"
rm -rf $SP
[ $fail = 0 ] && echo "ALL OK" || { echo "FAILURES"; exit 1; }
