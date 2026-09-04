# True Canadian Maps 0.2.0 — Linux x64 preview

The first public self-hosting preview includes Studio, a publication worker,
static map delivery and the marketing site. Start from nine map styles, add or
import locations, publish versioned maps, restore an earlier published release,
embed on another website and export your work.

- Safer autosave: serialized writes, atomic ETag conflicts, explicit retry,
  retained local drafts and guards against publishing unsaved changes.
- Account recovery with an explicit SMTP gate; email verification remains a
  separate setting. Authentication tokens are not logged.
- Linux x64 installer with database-first migration and seed ordering, pinned
  image versions, private administrator setup and backup/restore instructions.
- Forward migration from 32-bit to 64-bit basemap archive sizes.
- AGPL-3.0-only server/Studio and independent MIT browser SDK. Corresponding
  source, dependency notices, image provenance and SHA-256 checksums are included.

This is preview software. Published map content is public, including older
releases; origin restrictions do not make the files confidential. ARM64 and
disconnected installation have not been validated. Installation requires network
access for images and basemap/font assets. Public npm publication remains gated
on verified publisher ownership; use the supplied script embed or build the SDK
from source.

Review SELF_HOSTING.md and UPGRADING.md before installation or upgrades. Back up
the database, artifacts, basemap, fonts, sprites and protected configuration.
