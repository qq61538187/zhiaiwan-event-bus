import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const cjsEntry = require('../dist/index.cjs')
const esmEntry = await import(new URL('../dist/index.js', import.meta.url))

async function runSmoke(source, label) {
  if (typeof source.createEventBus !== 'function') {
    throw new Error(`${label}: createEventBus export missing`)
  }

  const bus = source.createEventBus()
  let called = false

  bus.on('smoke.ping', ([value]) => {
    called = value === 'ok'
    return `pong:${value}`
  })

  const matched = await bus.emit('smoke.ping', ['ok'])
  if (!matched || !called) {
    throw new Error(`${label}: emit smoke failed`)
  }

  const first = await bus.emitCollect('smoke.ping', ['ok2'], {
    collect: { kind: 'first' },
  })
  if (first !== 'pong:ok2') {
    throw new Error(`${label}: emitCollect smoke failed`)
  }

  await bus.destroy()
}

await runSmoke(cjsEntry, 'cjs')
await runSmoke(esmEntry, 'esm')

console.log('node smoke passed (cjs + esm)')
