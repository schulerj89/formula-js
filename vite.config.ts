import { defineConfig } from 'vite';

export default defineConfig({
  base: '/formula-js/',
  build: {
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        'asset-inspector': new URL('./asset-inspector.html', import.meta.url).pathname,
      },
    },
    sourcemap: true,
  },
});
