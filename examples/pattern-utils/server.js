import url from 'node:url'

export default async function handler(req, res) {
  const parsed = url.parse(req.url, true)
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      code: 0,
      data: {
        method: req.method,
        query: parsed.query,
      },
      message: 'ok',
    }),
  )
}
