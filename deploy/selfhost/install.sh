#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")"
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || { echo 'This release supports Linux x64 only.' >&2; exit 1; }
for tool in docker openssl; do command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }; done
docker compose version >/dev/null
case ${1:-configure} in
  configure)
    if [ ! -f .env ]; then cp .env.example .env; fi
    chmod 600 .env
    for key in POSTGRES_PASSWORD BETTER_AUTH_SECRET; do
      if grep -q "^$key=$" .env; then
        secret=$(openssl rand -hex 32)
        sed -i "s/^$key=$/$key=$secret/" .env
        unset secret
        echo "Generated $key in protected .env"
      fi
    done
    echo 'Edit .env with your real URLs and ACME email, then run ./install.sh start.'
    echo 'The application starts on loopback so administrator setup stays private.'
    ;;
  start)
    test -f .env || { echo 'Run ./install.sh configure first.' >&2; exit 1; }
    version=$(sed -n 's/^TCM_VERSION=//p' .env)
    [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][a-zA-Z0-9.-]+)?$ ]] || { echo 'TCM_VERSION must be a pinned release version.' >&2; exit 1; }
    if grep -Eq '^(PUBLIC_STUDIO_URL|STUDIO_HOST)=.*example\.com' .env; then echo 'Replace the example hostnames in .env before starting.' >&2; exit 1; fi
    docker compose config --quiet
    docker compose pull --policy missing db app worker delivery migrate seed
    docker compose up -d --wait db
    docker compose run --rm --no-deps migrate
    docker compose run --rm --no-deps seed
    docker compose --profile basemap run --rm --no-deps basemap
    docker compose up -d --no-deps delivery
    docker compose up -d --no-deps --wait app worker
    echo 'Studio is bound to loopback. Run ./install.sh setup to create the first administrator privately.'
    echo 'Then run ./install.sh expose to start HTTPS, or enable your existing reverse proxy.'
    ;;
  setup)
    read -rp 'Administrator name: ' admin_name
    read -rp 'Administrator email: ' admin_email
    read -rp 'Organization name: ' admin_org
    read -rsp 'Password (at least 10 characters): ' admin_password
    printf '\n'
    printf '%s\0%s\0%s\0%s' "$admin_name" "$admin_email" "$admin_org" "$admin_password" | docker compose exec -T app node -e '
      let input=""; process.stdin.on("data",b=>input+=b); process.stdin.on("end",async()=>{
        const [name,email,organizationName,password]=input.split("\0"); input="";
        try {
          const r=await fetch("http://127.0.0.1:3000/api/v1/setup",{method:"POST",headers:{"content-type":"application/json",origin:new URL(process.env.PUBLIC_STUDIO_URL).origin},body:JSON.stringify({name,email,organizationName,password})});
          if(!r.ok) throw Error("Setup failed (HTTP "+r.status+"). Check input requirements and whether setup is already complete.");
          console.log("Administrator created. You can now expose the installation.");
        } catch(e) { console.error(e.message); process.exitCode=1; }
      });'
    unset admin_password
    ;;
  expose)
    docker compose exec -T app node -e 'fetch("http://127.0.0.1:3000/api/v1/setup").then(r=>r.json()).then(s=>{if(s.needsSetup!==false)throw Error("Create the first administrator through a private tunnel before exposing Studio")}).catch(e=>{console.error(e.message);process.exit(1)})'
    docker compose --profile edge run --rm --no-deps edge caddy validate --config /etc/caddy/Caddyfile
    docker compose --profile edge up -d --no-deps edge
    ;;
  *) echo 'Usage: ./install.sh configure | start | setup | expose' >&2; exit 2 ;;
esac
