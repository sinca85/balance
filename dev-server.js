import http from 'node:http'
import { createServer as createViteServer } from 'vite'
import apiHandler from './api/index.js'

const port = Number(process.env.PORT || 5173)

const vite = await createViteServer({
  server: { middlewareMode: true, host: '0.0.0.0' },
  appType: 'spa',
})

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/api')) {
    await apiHandler(req, res)
    return
  }

  vite.middlewares(req, res)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Local app + API ready at http://localhost:${port}/`)
})
