// @ts-check
import { defineConfig } from 'astro/config';

// Static marketing site for roostr. Set `site` to the final deploy URL so
// canonical links and sitemap resolve correctly.
export default defineConfig({
  site: 'https://roostr.dev',
  build: {
    inlineStylesheets: 'auto',
  },
});
