const ORIGIN = 'https://alex-ai-powered-erp.onrender.com'

export default {
  async fetch(request) {
    const incoming = new URL(request.url)
    const target = new URL(incoming.pathname + incoming.search, ORIGIN)
    const headers = new Headers(request.headers)
    headers.set('x-forwarded-host', incoming.host)
    headers.set('x-forwarded-proto', 'https')

    return fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    })
  },
}
