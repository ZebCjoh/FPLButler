import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const proxyConfig = {
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
  // Specific pattern for standings to avoid conflicts with form API
  '^/api/league/[0-9]+$': {
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
};

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api requests to FPL API for development
    proxy: proxyConfig,
  },
  preview: {
    // Same proxy configuration for preview mode
    proxy: proxyConfig,
  },
})