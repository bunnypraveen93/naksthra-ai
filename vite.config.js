import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, join } from 'node:path';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';

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
 * 1) In `vite dev`, serves chat.entry.html with HMR when requesting /chat.html or /chat.
 * 2) In `vite build`, emits dist/chat.html + dist/assets/*, copies untouched static landing
 *    files into dist/, and also syncs built chat.html + assets/ to the repo root so static
 *    hosting without a build step (e.g. Cloudflare Pages root deploy or serve.ps1) works too.
 */
function nakshatraMultiHostPlugin() {
  return {
    name: 'nakshatra-multi-host-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0];
        if (cleanUrl === '/chat.html' || cleanUrl === '/chat' || cleanUrl === '/chat/') {
          try {
            const entryPath = resolve(__dirname, 'chat.entry.html');
            const rawHtml = readFileSync(entryPath, 'utf-8');
            const transformed = await server.transformIndexHtml(req.url, rawHtml);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(transformed);
            return;
          } catch (err) {
            return next(err);
          }
        }
        next();
      });
    },
    closeBundle() {
      const rootDir = __dirname;
      const outDir = resolve(rootDir, 'dist');
      mkdirSync(outDir, { recursive: true });

      const builtEntryHtml = join(outDir, 'chat.entry.html');
      const builtChatHtml = join(outDir, 'chat.html');
      if (existsSync(builtEntryHtml)) {
        renameSync(builtEntryHtml, builtChatHtml);
      }

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

      // Sync compiled chat.html and assets/ to repo root for zero-build static hosting & serve.ps1
      if (existsSync(builtChatHtml)) {
        cpSync(builtChatHtml, join(rootDir, 'chat.html'));
      }
      const distAssetsDir = join(outDir, 'assets');
      const rootAssetsDir = join(rootDir, 'assets');
      if (existsSync(distAssetsDir)) {
        rmSync(rootAssetsDir, { recursive: true, force: true });
        cpSync(distAssetsDir, rootAssetsDir, { recursive: true });
      }
    }
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), nakshatraMultiHostPlugin()],
  server: {
    port: 5173,
    open: '/chat.html'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat: resolve(__dirname, 'chat.entry.html')
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
