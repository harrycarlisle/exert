#!/usr/bin/env node
/**
 * Serves dist/ under http://127.0.0.1:4173/exert/ to simulate GitHub project Pages.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, '../dist')
const port = Number(process.env.PORT || 4173)
const prefix = '/exert'

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain' })
  res.end(body)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  let pathname = decodeURIComponent(url.pathname)

  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: `${prefix}/` })
    res.end()
    return
  }

  if (!pathname.startsWith(`${prefix}/`) && pathname !== prefix) {
    send(res, 404, 'Not found (expected /exert/...)')
    return
  }

  let rel = pathname.slice(prefix.length)
  if (!rel || rel === '/') rel = '/index.html'
  // SPA fallback
  let filePath = path.join(dist, rel)
  if (!filePath.startsWith(dist)) {
    send(res, 403, 'Forbidden')
    return
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(dist, '404.html')
    if (!fs.existsSync(filePath)) filePath = path.join(dist, 'index.html')
  }

  const ext = path.extname(filePath)
  const body = fs.readFileSync(filePath)
  send(res, 200, body, mime[ext] || 'application/octet-stream')
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Simulated GitHub Pages at http://127.0.0.1:${port}${prefix}/`)
})
