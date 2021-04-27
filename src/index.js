import { createServer } from 'node:http'
import { once } from 'node:events'
import { promisify } from 'node:util'
import express from 'express'

const PUBLIC_PATH = new URL('./public', import.meta.url).pathname

/**
 * @typedef {object} Event
 * @property {string} [id]
 * @property {string} [event]
 * @property {number} [retry]
 * @property {string} [data]
 * @property {string} [comment]
 *
 */

/**
 * @param {Event} event
 */
function renderEvent (event) {
  const lines = []
  if (event.id) lines.push(`id: ${event.id.replaceAll('\n', '')}`)
  if (event.event) lines.push(`event: ${event.event.replaceAll('\n', '')}`)
  if (event.retry) lines.push(`retry: ${event.retry}`)
  if (event.data) {
    event.data.split('\n').forEach(line => lines.push(`data: ${line}`))
  }
  if (event.comment) {
    event.comment.split('\n').forEach(line => lines.push(`: ${line}`))
  }
  lines.push('')
  lines.push('')
  return lines.join('\n')
}

/**
 * @param {object} params
 * @param {number} params.port
 */
async function start ({ port }) {
  /** @typedef {Set<import('node:http').ServerResponse>} */
  const clients = new Set()
  /**
   * @param {Event} event
   */
  function sendAll (event) {
    const renderedEvent = renderEvent(event)
    for (const res of clients) res.write(renderedEvent)
  }

  const app = express()
  app.get('/messages', (req, res) => {
    clients.add(res)
    // const lastEventId = req.get('last-event-id')
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache'
    })
    res.write('\n')
    req.on('close', () => {
      clients.delete(res)
    })
  })
  app.post('/messages', express.json(), (req, res) => {
    let message = req.body.message
    if (typeof message !== 'string') return res.sendStatus(400)
    message = message.trim()
    if (message) sendAll({ data: JSON.stringify({ message }) })
    res.sendStatus(201)
  })
  app.use(express.static(PUBLIC_PATH))

  const server = createServer(app)
  const close = promisify(server.close.bind(server))
  await once(server.listen(port), 'listening')
  console.log(`Server listening on port ${port}`)
  return async () => {
    for (const res of clients) {
      clients.delete(res)
      res.end()
    }
    await close()
  }
}

const { PORT = '3000' } = process.env

start({ port: Number(PORT) }).then(close => {
  function shutdown () {
    close()
      .then(() => process.exit())
      .catch(err => {
        console.error(err)
        process.exit(1)
      })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGUSR2', shutdown)
})
