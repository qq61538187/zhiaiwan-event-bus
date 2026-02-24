export default async function handler(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      code: 0,
      data: { method: req.method, target: 'policies' },
      message: 'ok',
    }),
  )
}
