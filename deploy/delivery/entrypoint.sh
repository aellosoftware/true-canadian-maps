#!/bin/sh
# Copy the embed build baked into the image onto the served root and write the API URL it advertises.
set -e
mkdir -p /srv/delivery/source
for src in /srv/delivery-source/*.tar.gz; do
  [ -f "$src" ] || continue
  dest="/srv/delivery/source/$(basename "$src")"
  if [ -e "$dest" ]; then
    cmp -s "$src" "$dest" || { echo 'Refusing to overwrite corresponding source for an existing revision' >&2; exit 1; }
  else
    cp "$src" "$dest.tmp"
    chmod 644 "$dest.tmp"
    mv "$dest.tmp" "$dest"
  fi
done
mkdir -p /srv/delivery/embed/v1
# Immutable build directories may only be reused when their bytes match.
# Install them before replacing the mutable loader, and never replace old builds.
for src in /srv/delivery-embed/v1/*; do
  [ -d "$src" ] || continue
  dest="/srv/delivery/embed/v1/$(basename "$src")"
  if [ -e "$dest" ]; then
    diff -r "$src" "$dest" >/dev/null || { echo "Refusing to overwrite immutable embed build" >&2; exit 1; }
  else
    cp -r "$src" "$dest.tmp"
    mv "$dest.tmp" "$dest"
  fi
done
cp /srv/delivery-embed/v1.js /srv/delivery/embed/v1.js.tmp
mv /srv/delivery/embed/v1.js.tmp /srv/delivery/embed/v1.js
cp /srv/delivery-embed/version.json /srv/delivery/embed/version.json.tmp
mv /srv/delivery/embed/version.json.tmp /srv/delivery/embed/version.json
if [ -n "${PUBLIC_API_URL:-}" ]; then
  printf '{"apiUrl":"%s"}' "${PUBLIC_API_URL%/}" > /srv/delivery/embed/v1/config.json
fi
mkdir -p /srv/delivery/base /srv/delivery/fonts /srv/delivery/sprites /srv/delivery/t /srv/delivery/p /srv/delivery/gallery
# app and worker run as node (uid/gid 1000). Nginx's root entrypoint must not
# create unwritable publication directories on an empty artifact volume.
mkdir -p /srv/delivery/uploads
chown 1000:1000 /srv/delivery/t /srv/delivery/p /srv/delivery/gallery /srv/delivery/uploads
