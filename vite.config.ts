import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api requests to FPL API for development
    proxy: {
      '/api/bootstrap-static': {
        target: 'https://fantasy.premierleague.com/api/bootstrap-static/',
        changeOrigin: true,
        rewrite: () => '',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'FPLButler/1.0');
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
            proxyReq.setHeader('Referer', 'https://fantasy.premierleague.com/');
          });
        },
      },
      '/api/league': {
        target: 'https://fantasy.premierleague.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/league\/(.+)/, '/leagues-classic/$1/standings/'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'FPLButler/1.0');
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
            proxyReq.setHeader('Referer', 'https://fantasy.premierleague.com/');
          });
        },
      },
      '/api/event': {
        target: 'https://fantasy.premierleague.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') + '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'FPLButler/1.0');
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
            proxyReq.setHeader('Referer', 'https://fantasy.premierleague.com/');
          });
        },
      },
      '/api/entry': {
        target: 'https://fantasy.premierleague.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') + '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'FPLButler/1.0');
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
            proxyReq.setHeader('Referer', 'https://fantasy.premierleague.com/');
          });
        },
      },
    },
  },
})