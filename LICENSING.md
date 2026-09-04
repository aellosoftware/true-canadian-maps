# Licensing

Copyright (c) 2026 Aello Software.

The True Canadian Maps server, Studio, worker, marketing implementation, shared
server packages, build tooling and self-hosting scripts are licensed under
**GNU Affero General Public License version 3 only (AGPL-3.0-only)**. See `LICENSE`.

The standalone browser embed and SDK in `packages/embed/` are licensed under
**MIT**. See `packages/embed/LICENSE`. This package builds from its own browser
implementation and public interfaces, without importing AGPL implementation code.

Third-party software, fonts, sprites and map data retain their own licences and
copyrights. See `THIRD_PARTY_NOTICES.md`, the bundled notices and the licences
shipped with downloaded map assets. Preserve the required map attribution.
These licences do not grant rights to use Aello Software or True Canadian Maps
trademarks to imply endorsement.

Public releases include the corresponding source and build/install instructions.
The managed deployment exposes corresponding source for its exact revision at
`https://truecanadianmaps.com/source/<revision>.tar.gz`; its current revision is
available from `/version.json`. Versioned releases are also available at
`https://github.com/aellosoftware/true-canadian-maps/releases`.

Operators who modify the AGPL application and let users interact with it over a
network must make the corresponding source available as required by section 13.
Distribute the licence and notices with binaries and retain the source offer.
The public browser SDK's separate MIT grant does not relicense the server.
