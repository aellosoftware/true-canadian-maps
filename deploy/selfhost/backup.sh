#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")"
destination=$(realpath -m "${1:?usage: ./backup.sh /private/backup-directory}")
test ! -e "$destination" || { echo 'Use a new backup directory; existing backups are never overwritten.' >&2; exit 2; }
mkdir -p "$destination"
running=()
for service in app worker; do
  id=$(docker compose ps -q "$service")
  if [ -n "$id" ] && [ "$(docker inspect "$id" --format '{{.State.Running}}')" = true ]; then running+=("$id"); fi
done
resume() { if [ ${#running[@]} -gt 0 ]; then docker start "${running[@]}" >/dev/null; fi; }
trap resume EXIT
if [ ${#running[@]} -gt 0 ]; then docker stop "${running[@]}" >/dev/null; fi
docker compose exec -T db pg_dump -U tcm -d tcm -Fc > "$destination/database.dump"
delivery=$(docker compose ps -aq delivery)
test -n "$delivery"
for pair in artifacts:/srv/delivery basemap:/srv/delivery/base fonts:/srv/delivery/fonts sprites:/srv/delivery/sprites; do
  name=${pair%%:*}; target=${pair#*:}
  volume=$(docker inspect "$delivery" --format "{{range .Mounts}}{{if eq .Destination \"$target\"}}{{.Name}}{{end}}{{end}}")
  [[ $volume =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || { echo "Expected named $name volume" >&2; exit 2; }
  docker run --rm -v "$volume:/data:ro" alpine:3.22 tar -czf - -C /data . > "$destination/$name.tar.gz"
done
cp .env "$destination/runtime.env"
cp docker-compose.yml Caddyfile Caddyfile.multi "$destination/"
for service in app worker delivery; do
  id=$(docker compose ps -aq "$service")
  docker inspect "$id" --format '{{.Name}} {{.Config.Image}} {{.Image}}' >> "$destination/images.txt"
done
(cd "$destination" && sha256sum database.dump artifacts.tar.gz basemap.tar.gz fonts.tar.gz sprites.tar.gz runtime.env docker-compose.yml Caddyfile Caddyfile.multi images.txt > SHA256SUMS)
echo "Complete private backup: $destination"
