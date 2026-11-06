import {copyFile} from 'node:fs/promises';

// Publish the shared preview at a stable, same-origin URL for social crawlers.
await copyFile(
  new URL('../../docs/images/social-preview.png', import.meta.url),
  new URL('../dist/social-preview.png', import.meta.url)
);
