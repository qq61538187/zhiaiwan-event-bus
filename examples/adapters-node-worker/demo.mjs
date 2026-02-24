import { MessageChannel } from 'node:worker_threads'
import {
  InMemoryAdapter,
  NodeWorkerThreadsAdapter,
  createEventBus,
} from '../../dist/index.js'

async function main() {
  const { port1, port2 } = new MessageChannel()
  const busA = createEventBus({
    adapters: [new InMemoryAdapter(), new NodeWorkerThreadsAdapter(port1)],
  })
  const busB = createEventBus({
    adapters: [new InMemoryAdapter(), new NodeWorkerThreadsAdapter(port2)],
  })

  const received = new Promise((resolve) => {
    busB.on('worker.ping', ([msg]) => {
      resolve(msg)
    })
  })

  await busA.emit('worker.ping', ['hello-from-main'])
  const result = await Promise.race([
    received,
    new Promise((_, reject) => setTimeout(() => reject(new Error('node worker demo timeout')), 1200)),
  ])

  await busA.destroy()
  await busB.destroy()
  port1.close()
  port2.close()

  return {
    passed: result === 'hello-from-main',
    received: result,
  }
}

try {
  const data = await main()
  process.stdout.write(`${JSON.stringify(data)}\n`)
  process.exitCode = data.passed ? 0 : 1
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
