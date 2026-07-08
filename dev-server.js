import http from 'node:http'
import { createServer as createViteServer } from 'vite'
import apiHandler from './api/index.js'

const port = Number(process.env.PORT || 5173)
const authUser = process.env.BASIC_AUTH_USER || 'santi'
const authPass = process.env.BASIC_AUTH_PASS || 'sava9379'

function isAuthorized(req) {
  const header = req.headers.authorization || ''
  const [scheme, encoded] = header.split(' ')
  if (scheme !== 'Basic' || !encoded) return false

  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  return decoded === `${authUser}:${authPass}`
}

function requestAuth(res) {
  res.statusCode = 401
  res.setHeader('WWW-Authenticate', 'Basic realm="Balance"')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end('Authentication required')
}

const vite = await createViteServer({
  server: { middlewareMode: true, host: '0.0.0.0' },
  appType: 'spa',
})

const server = http.createServer(async (req, res) => {
  if (!isAuthorized(req)) {
    requestAuth(res)
    return
  }

  if (req.url?.startsWith('/api')) {
    await apiHandler(req, res)
    return
  }

  vite.middlewares(req, res)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Local app + API ready at http://localhost:${port}/`)
})
