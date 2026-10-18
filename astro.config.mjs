import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://doon.today',
  output: 'static',
  // Generates sitemap-index.xml, which public/robots.txt points at.
  integrations: [sitemap()]
});
