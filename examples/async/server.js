import url from 'node:url'

export default async function handler(req, res) {
  const parsed = url.parse(req.url, true)
  const delay = Number(parsed.query.delay || 120)
  const id = String(parsed.query.id || '')

  await new Promise((resolve) => setTimeout(resolve, delay))

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      code: 0,
      data: { id, delay },
      message: 'ok',
    }),
  )
}
