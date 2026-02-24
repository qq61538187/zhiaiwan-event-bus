import { createServer } from 'node:http'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const projectRoot = resolve(__dirname, '..')
const port = Number(process.argv[2] || 3000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function getExampleDirs() {
  return readdirSync(__dirname).filter((name) => {
    const full = join(__dirname, name)
    if (!statSync(full).isDirectory()) return false
    return existsSync(join(full, 'index.html'))
  })
}

function indexHtml(dirs) {
  const links = dirs
    .map(
      (d) =>
        `<li><a href="/${d}/">${d}</a> <span style="color:#64748b;font-size:12px">interactive demo</span></li>`,
    )
    .join('')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>event-bus examples</title>
  <link rel="stylesheet" href="/shared.css" />
</head>
<body>
  <div class="page">
    <div class="page-header">
      <h1>@zhiaiwan/event-bus examples</h1>
      <p>build first: <code>pnpm build</code></p>
    </div>
    <div class="card">
      <h3>Available demos</h3>
      <ul>${links}</ul>
    </div>
  </div>
  <script type="module" src="/i18n-ui.js"></script>
</body>
</html>`
}

function safeResolve(base, reqPath) {
  const cleaned = normalize(reqPath).replace(/^(\.\.[/\\])+/, '')
  return resolve(base, `.${cleaned.startsWith('/') ? cleaned : `/${cleaned}`}`)
}

function serveFile(res, filePath) {
  const ext = extname(filePath)
  const contentType = MIME[ext] || 'application/octet-stream'
  if (ext === '.html') {
    const html = readFileSync(filePath, 'utf-8')
    const injected = html.includes('/i18n-ui.js')
      ? html
      : html.replace('</body>', '  <script type="module" src="/i18n-ui.js"></script>\n</body>')
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(injected)
    return
  }
  const buf = readFileSync(filePath)
  res.writeHead(200, { 'Content-Type': contentType })
  res.end(buf)
}

const server = createServer(async (req, res) => {
  const reqUrl = req.url || '/'

  if (reqUrl === '/' || reqUrl === '/index.html') {
    const html = indexHtml(getExampleDirs())
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  if (reqUrl === '/favicon.ico') {
    res.writeHead(204, { 'Content-Type': 'image/x-icon' })
    res.end()
    return
  }

  // /<example>/server -> dynamic import examples/<example>/server.js
  const m = reqUrl.match(/^\/([^/]+)\/server(?:\?.*)?$/)
  if (m) {
    const exampleName = m[1]
    const handlerFile = join(__dirname, exampleName, 'server.js')
    if (!existsSync(handlerFile)) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ code: 404, data: null, message: 'Example server not found' }))
      return
    }
    const mod = await import(pathToFileURL(handlerFile).href)
    await mod.default(req, res)
    return
  }

  // static: prefer examples/, fallback to project root
  const localPath = reqUrl.endsWith('/') ? `${reqUrl}index.html` : reqUrl
  const fileInExamples = safeResolve(__dirname, localPath)
  if (fileInExamples.startsWith(__dirname) && existsSync(fileInExamples) && statSync(fileInExamples).isFile()) {
    serveFile(res, fileInExamples)
    return
  }

  const fileInProject = safeResolve(projectRoot, localPath)
  if (fileInProject.startsWith(projectRoot) && existsSync(fileInProject) && statSync(fileInProject).isFile()) {
    serveFile(res, fileInProject)
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Not Found')
})

server.listen(port, () => {
  // biome-ignore lint/suspicious/noConsole: example server startup log
  console.log(`Examples running at http://localhost:${port}`)
})
