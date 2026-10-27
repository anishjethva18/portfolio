import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Plugin, ViteDevServer } from 'vite';
import { defineConfig } from 'vite';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(clientRoot, 'public');
const publicMediaGroups = {
  audio: new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']),
  videos: new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'wmv', 'm4v']),
  wallpapers: new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']),
  downloads: undefined,
} as const;
const publicMediaModuleId = 'virtual:portfolio-public-media';
const resolvedPublicMediaModuleId = `\0${publicMediaModuleId}`;

function getPublicMediaManifest(): Record<string, Array<{ name: string; url: string }>> {
  return Object.fromEntries(Object.entries(publicMediaGroups).map(([group, allowedExtensions]) => {
    const directory = path.join(publicRoot, group);
    let assets: Array<{ name: string; url: string }> = [];
    try {
      assets = fs.readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => {
          const extension = path.extname(name).slice(1).toLowerCase();
          return allowedExtensions ? allowedExtensions.has(extension as never) : Boolean(extension);
        })
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
        .map((name) => ({ name, url: `/${group}/${encodeURIComponent(name)}` }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Could not scan public ${group} assets: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    return [group, assets];
  }));
}

function publicMediaManifestPlugin(): Plugin {
  return {
    name: 'portfolio-public-media-manifest',
    resolveId(id) {
      return id === publicMediaModuleId ? resolvedPublicMediaModuleId : null;
    },
    load(id) {
      if (id !== resolvedPublicMediaModuleId) return null;
      return `export const publicMedia = ${JSON.stringify(getPublicMediaManifest())};`;
    },
    configureServer(server: ViteDevServer) {
      server.watcher.add(Object.keys(publicMediaGroups).map((group) => path.join(publicRoot, group)));
    },
    handleHotUpdate({ file, server }) {
      const normalizedFile = path.resolve(file);
      if (!Object.keys(publicMediaGroups).some((group) =>
        normalizedFile.startsWith(`${path.join(publicRoot, group)}${path.sep}`)
      )) return;
      const module = server.moduleGraph.getModuleById(resolvedPublicMediaModuleId);
      if (module) server.moduleGraph.invalidateModule(module);
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

export default defineConfig({
  root: clientRoot,
  plugins: [react(), tailwindcss(), publicMediaManifestPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(clientRoot, 'src'),
    },
  },
  build: {
    outDir: path.resolve(clientRoot, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Produce readable, consistent asset filenames while keeping a short hash for cache-busting.
        // Format examples: assets/AboutApp-<hash>.js, assets/index-<hash>.css
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // React core runtime
          if (
            id.includes('/node_modules/react/') ||
            id.includes('\\node_modules\\react\\') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('\\node_modules\\react-dom\\') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('\\node_modules\\scheduler\\')
          ) {
            return 'vendor-react-core';
          }

          if (
            id.includes('/node_modules/motion/') ||
            id.includes('\\node_modules\\motion\\')
          ) {
            return 'vendor-motion';
          }

          if (
            id.includes('/node_modules/lucide-react/') ||
            id.includes('\\node_modules\\lucide-react\\')
          ) {
            return 'vendor-lucide';
          }

          if (
            id.includes('/node_modules/recharts/') ||
            id.includes('\\node_modules\\recharts\\') ||
            id.includes('/node_modules/d3-') ||
            id.includes('\\node_modules\\d3-') ||
            id.includes('/node_modules/victory-vendor/') ||
            id.includes('\\node_modules\\victory-vendor\\')
          ) {
            return 'vendor-charts';
          }

          if (
            id.includes('/node_modules/jspdf/') ||
            id.includes('\\node_modules\\jspdf\\')
          ) {
            return 'vendor-jspdf';
          }

          if (
            id.includes('/node_modules/html2canvas/') ||
            id.includes('\\node_modules\\html2canvas\\')
          ) {
            return 'vendor-html2canvas';
          }

        },
      },
    },
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  preview: {
    proxy: {},
  },
});
