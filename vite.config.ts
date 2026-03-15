import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: './src/ui',
  plugins: [viteSingleFile()],
  build: {
    outDir: '../../dist/ui',
    emptyOutDir: true,
    target: 'esnext',
    assetsInlineLimit: 10000, // Reduced from 100MB to 10KB
    chunkSizeWarningLimit: 500000, // 500KB warning limit
    cssCodeSplit: false,
    brotliSize: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined, // Disable manual chunking for single file
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['@modelcontextprotocol/ext-apps'],
    exclude: ['tone', 'wavesurfer.js'], // Don't pre-bundle heavy libs
  },
});
