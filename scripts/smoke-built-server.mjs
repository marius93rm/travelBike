import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

async function findAvailablePort() {
  const probe = createServer()
  await new Promise((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', resolve)
  })
  const address = probe.address()
  if (!address || typeof address === 'string') {
    throw new Error('Could not reserve a local port for the built server smoke test.')
  }
  const { port } = address
  await new Promise((resolve, reject) => {
    probe.close((error) => error ? reject(error) : resolve())
  })
  return port
}

function bucharestToday() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function waitForStartup(child, port) {
  let output = ''
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Built server did not become ready on ${port}. Output: ${output}`))
    }, 10_000)

    const collect = (chunk) => {
      output += chunk.toString()
      if (output.includes(`BikeTrain API listening on port ${port}`)) {
        clearTimeout(timeout)
        resolve()
      }
    }

    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      reject(new Error(
        `Built server exited before startup (code ${code}, signal ${signal}). Output: ${output}`,
      ))
    })
  })
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill('SIGTERM')
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ])
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
}

const port = await findAvailablePort()
const child = spawn(process.execPath, ['build/server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), ENABLE_CFR_WEB_ADAPTER: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const baseUrl = `http://127.0.0.1:${port}`

try {
  await waitForStartup(child, port)

  const home = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) })
  assert.equal(home.status, 200, 'the production server should serve the SPA')
  assert.match(await home.text(), /<div id="root">/)

  const health = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5_000) })
  assert.equal(health.status, 200, 'liveness should be healthy')

  const readiness = await fetch(`${baseUrl}/api/readiness`, {
    signal: AbortSignal.timeout(5_000),
  })
  assert.equal(readiness.status, 503, 'readiness should remain degraded with CFR disabled')
  const readinessBody = await readiness.json()
  assert.equal(readinessBody.pilot?.mappingComplete, true)
  assert.equal(readinessBody.providers?.journeySearch, 'disabled')

  const coverageUrl = new URL('/api/coverage', baseUrl)
  coverageUrl.search = new URLSearchParams({
    from: 'brasov', to: 'codlea', date: bucharestToday(),
  }).toString()
  const coverage = await fetch(coverageUrl, { signal: AbortSignal.timeout(5_000) })
  assert.equal(coverage.status, 200)
  const coverageBody = await coverage.json()
  assert.equal(coverageBody.route?.providerStatus, 'disabled')

  const trainUrl = new URL('/api/trains', baseUrl)
  trainUrl.search = new URLSearchParams({
    from: 'brasov', to: 'codlea', date: bucharestToday(), bike: 'true',
  }).toString()
  const search = await fetch(trainUrl, { signal: AbortSignal.timeout(5_000) })
  assert.equal(search.status, 200)
  const searchBody = await search.json()
  assert.deepEqual(searchBody.options, [])
  assert.equal(searchBody.meta?.coverage, 'unavailable')
  assert.equal(searchBody.meta?.providerStatus, 'disabled')

  console.log('Built server smoke passed: SPA, health, readiness, coverage, and fail-closed search.')
} finally {
  await stopChild(child)
}
