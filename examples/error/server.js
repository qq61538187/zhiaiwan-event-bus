import url from 'node:url'

export default async function handler(req, res) {
  const parsed = url.parse(req.url, true)
  const path = String(parsed.query.path || '/api/ok')

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      code: 0,
      data: { path, method: req.method },
      message: 'ok',
    }),
  )
}
