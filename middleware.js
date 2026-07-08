const authUser = process.env.BASIC_AUTH_USER || 'santi'
const authPass = process.env.BASIC_AUTH_PASS || 'sava9379'

function isAuthorized(request) {
  const header = request.headers.get('authorization') || ''
  const [scheme, encoded] = header.split(' ')
  if (scheme !== 'Basic' || !encoded) return false

  try {
    return atob(encoded) === `${authUser}:${authPass}`
  } catch {
    return false
  }
}

export default function middleware(request) {
  if (isAuthorized(request)) return

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Balance"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

export const config = {
  matcher: '/:path*',
}
