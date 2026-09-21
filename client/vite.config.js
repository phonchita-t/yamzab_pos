import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from a subpath on GitHub Pages (https://phonchita-t.github.io/yamzab_pos/),
// but from the domain root in dev and in any other deployment target.
const BASE = process.env.GITHUB_PAGES ? '/yamzab_pos/' : '/';

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: {
    port: 5173,
  },
});
