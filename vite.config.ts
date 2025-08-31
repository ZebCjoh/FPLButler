import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fpl-proxy-middleware',
      configureServer(server) {
        server.middlewares.use('/fpl', async (req, res, next) => {
          try {
            const path = req.url || '/'
            const target = 'https://fantasy.premierleague.com' + path.replace(/^\/fpl/, '')
            const response = await fetch(target, {
              headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'accept': 'application/json, text/plain, */*',
                'referer': 'https://fantasy.premierleague.com/',
              },
              redirect: 'follow',
            })

            const contentType = response.headers.get('content-type') || 'application/json'
            res.setHeader('content-type', contentType)
            res.statusCode = response.status
            const body = await response.text()
            res.end(body)
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Proxy error', details: String(err) }))
          }
        })
      },
    },
  ],
  server: {
    // Setter opp en proxy for å unngå CORS-problemer når vi kaller FPL sitt API fra localhost.
    // Alle forespørsler til /api i vår app vil bli videresendt til fantasy.premierleague.com.
    proxy: {
      '/api': {
        target: 'https://fantasy.premierleague.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
            proxyReq.setHeader('Referer', 'https://fantasy.premierleague.com/');
          });
        },
      },
    },
  },
})