import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://doon.today',
  output: 'static',
  // Generates sitemap-index.xml, which public/robots.txt points at.
  // The submit form's thank-you page is not worth indexing.
  integrations: [sitemap({ filter: (page) => !page.endsWith('/submit/thanks/') })]
});
