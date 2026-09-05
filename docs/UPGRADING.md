# Upgrade and rollback

Read the target release notes. Keep image versions pinned and keep the previous
installer/configuration as well as a complete private backup.

1. Run `./backup.sh /private-backups/tcm-before-upgrade` and verify its checksums.
2. Extract the new installer into a new directory. Copy the protected `.env` there,
   update `TCM_VERSION` to the released version and retain the same Compose project
   name, ports, URLs and data-volume names. Review configuration changes.
3. Run `./install.sh start`. The database is started first; migrations and seed
   complete before the worker/application are replaced. Existing files remain.
4. Verify health, sign-in, gallery, a new test publication and an existing embed.
   Check byte ranges, fonts, sprites, revision metadata and SMTP if enabled.
5. Keep the previous images and backup until the new version is accepted. Do not
   prune rollback images or delete old immutable publication/basemap assets.

Version 0.2.1 fixes account-email failure reporting and database readiness during
first installation. It does not introduce another schema migration.

The 0.2.0 forward migration widens `basemap_versions.size_bytes` to PostgreSQL
`bigint`. Registration preserves archive sizes above 2 GB. No account schema
migration or automatic email-verification policy change is introduced.

For an application rollback, restore the previous installer and image version
and start only `app`, `worker` and `delivery` with `docker compose up -d --no-deps`.
Keep the widened database field; do not narrow it to 32 bits. Validate the previous
application against the forward-compatible schema before restoring traffic.

If a release requires a database rollback, restore the full pre-upgrade backup
into a separate installation and verify it before switching traffic. Restoring
an older database loses writes made after that backup; keep the failed
installation and its data for recovery. Never run a database-resetting E2E helper
against a real installation.
