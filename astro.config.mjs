import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
  vite: {
    // MapLibre 6 runs its web worker as an ES module (see MapPrototype.tsx).
    worker: { format: 'es' },
  },
  trailingSlash: 'ignore',
});
