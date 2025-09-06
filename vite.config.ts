import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const proxyConfig = {
    '/api/bootstrap-static': {
      target: 'https://fantasy.premierleague.com/api/bootstrap-static/',
      changeOrigin: true,
      rewrite: () => '',
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any) => {
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
      rewrite: (path: string) => path.replace(/^\/api\/league\/(.+)/, '/leagues-classic/$1/standings/'),
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any) => {
          proxyReq.setHeader('User-Agent', 'FPLButler/1.0');
          proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
          proxyReq.setHeader('Referer', 'https://fantasy.premierleague.com/');
        });
      },
    },
    '/api/event': {
      target: 'https://fantasy.premierleague.com/api',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, '') + '/',
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any) => {
          proxyReq.setHeader('User-Agent', 'FPLButler/1.0');
          proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
          proxyReq.setHeader('Referer', 'https://fantasy.premierleague.com/');
        });
      },
    },
    '/api/entry': {
      target: 'https://fantasy.premierleague.com/api',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, '') + '/',
      configure: (proxy: any) => {
        proxy.on('proxyReq', (proxyReq: any) => {
          proxyReq.setHeader('User-Agent', 'FPLButler/1.0');
          proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
          proxyReq.setHeader('Referer', 'https://fantasy.premierleague.com/');
        });
      },
    },
  };
  
  const config = {
    plugins: [react()],
    server: {},
    preview: {}
  };

  // Conditionally apply proxy for 'serve' command (local development)
  if (command === 'serve') {
    config.server = {
      proxy: proxyConfig
    };
    config.preview = {
      proxy: proxyConfig
    };
  }

  return config;
});