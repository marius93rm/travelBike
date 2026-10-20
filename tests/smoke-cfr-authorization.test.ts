import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const smokeScript = resolve(process.cwd(), 'scripts/smoke-cfr.mjs')

function runSmoke(args: string[], authorizationReference?: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SMOKE_BASE_URL: 'http://127.0.0.1:1',
  }
  if (authorizationReference === undefined) delete env.CFR_WRITTEN_AUTHORIZATION_REF
  else env.CFR_WRITTEN_AUTHORIZATION_REF = authorizationReference

  return spawnSync(process.execPath, [smokeScript, '--date', '2026-10-24', ...args], {
    encoding: 'utf8',
    env,
    timeout: 5_000,
  })
}

async function createSmokeApi(includeTicketEvidence: boolean) {
  let requests = 0
  const observedAt = new Date().toISOString()
  const evidence = (source: string) => ({
    source,
    sourceUrl: 'https://www.cfrcalatori.ro/transportul-bicicletelor-si-schiurilor/',
    verifiedAt: observedAt,
  })
  const server = createServer((request, response) => {
    requests += 1
    const body = request.url === '/api/readiness'
      ? {
          ok: true,
          status: 'ready',
          pilot: { mappingComplete: true, allowlistVersion: 'test-v1' },
          providers: { journeySearch: 'ready' },
        }
      : {
          meta: {
            coverage: 'covered',
            asOf: observedAt,
            sources: [{ providerId: 'cfr', outcome: 'success', fetchedAt: observedAt }],
          },
          options: [{
            id: 'cfr-ir-1622',
            bikeAllowed: true,
            bikeType: 'non_foldable',
            bikeFeeLei: null,
            lastVerifiedAt: observedAt,
            sourceUrl: 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
            bikeReservationEvidence: evidence('Reguli transport biciclete CFR'),
            ...(includeTicketEvidence
              ? { bikeTicketPurchaseEvidence: evidence('Termeni CFR bilete online') }
              : {}),
            bikeFeeEvidence: evidence('Tarife CFR biciclete'),
          }],
        }

    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  })
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })

  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests: () => requests,
    close: () => new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose())
    }),
  }
}

function runAuthorizedSmoke(baseUrl: string) {
  const child = spawn(process.execPath, [
    smokeScript,
    '--date',
    '2026-10-24',
    '--confirm-authorized-live-test',
  ], {
    env: {
      ...process.env,
      SMOKE_BASE_URL: baseUrl,
      CFR_WRITTEN_AUTHORIZATION_REF: 'approval-42',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk })

  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolveRun, rejectRun) => {
    child.once('error', rejectRun)
    child.once('close', (code) => resolveRun({ code, stdout, stderr }))
  })
}

describe('CFR live smoke authorization gate', () => {
  it.each([
    { label: 'no authorization reference or confirmation', args: [], reference: undefined },
    { label: 'confirmation but no authorization reference', args: ['--confirm-authorized-live-test'], reference: undefined },
    { label: 'the example placeholder with explicit confirmation', args: ['--confirm-authorized-live-test'], reference: '<approval-document-or-ticket-reference>' },
    { label: 'authorization reference but no confirmation', args: [], reference: 'approval-42' },
  ])('refuses to call the API with $label', ({ args, reference }) => {
    const result = runSmoke(args, reference)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('autorizzazione scritta')
    expect(result.stderr).not.toContain('ECONNREFUSED')
  })

  it('rejects CFR results that omit the ticket-purchase evidence', async () => {
    const api = await createSmokeApi(false)
    try {
      const result = await runAuthorizedSmoke(api.baseUrl)

      expect(result.code).toBe(1)
      expect(result.stderr).toContain('cumpărare a biletului')
      expect(api.requests()).toBe(2)
    } finally {
      await api.close()
    }
  })

  it('accepts current, sourced evidence for all three bicycle policies', async () => {
    const api = await createSmokeApi(true)
    try {
      const result = await runAuthorizedSmoke(api.baseUrl)

      expect(result.code).toBe(0)
      expect(api.requests()).toBe(5)
    } finally {
      await api.close()
    }
  })
})
