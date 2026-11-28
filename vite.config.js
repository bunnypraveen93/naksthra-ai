import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, join } from 'node:path';
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const STATIC_ROOT_FILES = [
  'index.html',
  'about.html',
  'contact.html',
  'support.html',
  'terms.html',
  'privacy.html',
  'google19e8e43c43f0d1de.html',
  'style.css'
];

const STATIC_ROOT_DIRS = ['images'];

/**
 * Copies the untouched static landing page, subpages, stylesheets, and images
 * into dist/ alongside the compiled React chat app (dist/chat.html) for Cloudflare Pages.
 */
function copyStaticLandingAssets() {
  return {
    name: 'copy-static-landing-assets',
    closeBundle() {
      const rootDir = __dirname;
      const outDir = resolve(rootDir, 'dist');
      mkdirSync(outDir, { recursive: true });

      for (const file of STATIC_ROOT_FILES) {
        const src = join(rootDir, file);
        if (existsSync(src)) {
          cpSync(src, join(outDir, file));
        }
      }

      for (const dir of STATIC_ROOT_DIRS) {
        const src = join(rootDir, dir);
        if (existsSync(src)) {
          cpSync(src, join(outDir, dir), { recursive: true });
        }
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), copyStaticLandingAssets()],
  server: {
    port: 5173,
    open: '/chat.html'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat: resolve(__dirname, 'chat.html')
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-markdown': ['marked', 'dompurify', 'highlight.js/lib/common']
        }
      }
    }
  }
});
