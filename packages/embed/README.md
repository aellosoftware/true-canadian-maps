# True Canadian Maps browser SDK

An independent MIT browser implementation for displaying public True Canadian
Maps releases. It uses MapLibre and PMTiles, with no dependency on server or Studio
implementation packages. Map files remain public; origin restrictions are not
confidentiality controls.

The script embed supplied by a running installation is ready to use. Public npm
publication is gated on verified namespace ownership. Until that gate is complete,
build and pack this source package locally rather than using a registry install.

From this directory, with Node.js 22.12+ and pnpm 11.25.0:

```sh
pnpm install
pnpm build
pnpm pack --out truecanadianmaps-web.tgz
```

In a clean consuming project, install that tarball and import:

```js
import { createMap } from '@truecanadianmaps/web';
import '@truecanadianmaps/web/style.css';

const map = await createMap({
  container: document.getElementById('map'),
  apiUrl: 'https://your-studio.example/api',
  projectId: 'your-project-id',
  publicKey: 'your-public-map-key',
});
```

Give the container a height. Keep map attribution visible. Your bundler must serve
MapLibre's worker assets; see the `workerUrl` option when using a custom asset path.
The shipped script embed configures these assets automatically.

See `LICENSE` and `THIRD_PARTY_NOTICES.txt`. The server is separately licensed
under AGPL-3.0-only; this SDK's MIT licence does not change the server licence.
