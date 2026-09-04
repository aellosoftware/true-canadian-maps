#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")"
backup=$(realpath "${1:?usage: ./restore.sh /private/backup-directory --replace-existing}")
test "${2:-}" = --replace-existing || { echo 'Restore replaces this Compose installation. Back it up first, then supply --replace-existing.' >&2; exit 2; }
(cd "$backup" && sha256sum --quiet -c SHA256SUMS)
for name in artifacts basemap fonts sprites; do
  # Accept archives made by backup.sh, with relative paths inside the named volume.
  if tar -tzf "$backup/$name.tar.gz" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then echo 'Unsafe archive path' >&2; exit 2; fi
done
docker compose config --quiet
docker compose stop app worker delivery
docker compose up -d --wait db
docker compose up --no-start --no-deps app worker delivery >/dev/null
# Restore into an empty database: PostgreSQL cannot individually drop inherited
# primary-key constraints from pg-boss partitions during pg_restore --clean.
docker compose exec -T db pg_restore --list < "$backup/database.dump" >/dev/null
docker compose exec -T db dropdb -U tcm --if-exists --force tcm
docker compose exec -T db createdb -U tcm tcm
docker compose exec -T db pg_restore -U tcm -d tcm --no-owner --no-privileges --exit-on-error --single-transaction < "$backup/database.dump"
delivery=$(docker compose ps -aq delivery)
for pair in artifacts:/srv/delivery basemap:/srv/delivery/base fonts:/srv/delivery/fonts sprites:/srv/delivery/sprites; do
  name=${pair%%:*}; target=${pair#*:}
  volume=$(docker inspect "$delivery" --format "{{range .Mounts}}{{if eq .Destination \"$target\"}}{{.Name}}{{end}}{{end}}")
  [[ $volume =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || { echo "Expected named $name volume" >&2; exit 2; }
  # Only this verified named volume is mounted in the helper container.
  docker run --rm -i -v "$volume:/data" alpine:3.22 sh -ec 'find /data -mindepth 1 -delete; tar -xzf - -C /data' < "$backup/$name.tar.gz"
done
docker compose run --rm --no-deps migrate
docker compose run --rm --no-deps seed
docker compose up -d --no-deps delivery
docker compose up -d --no-deps --wait app worker
echo 'Restore completed. Verify sign-in, maps and published embeds before exposing traffic.'
echo 'Protected configuration remains in your current .env; the backup copy is runtime.env.'
