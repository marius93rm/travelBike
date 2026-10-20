import { describe, expect, it } from 'vitest'
import {
  cfrWebAdapterEnabled,
  hasCfrWrittenAuthorizationReference,
} from '../server/config/cfr-authorization.js'

describe('CFR web adapter authorization gate', () => {
  it('requires a non-empty reference to written authorization', () => {
    expect(hasCfrWrittenAuthorizationReference({})).toBe(false)
    expect(hasCfrWrittenAuthorizationReference({ CFR_WRITTEN_AUTHORIZATION_REF: '   ' }))
      .toBe(false)
    expect(hasCfrWrittenAuthorizationReference({
      CFR_WRITTEN_AUTHORIZATION_REF: '<approval-document-or-ticket-reference>',
    })).toBe(false)
    expect(hasCfrWrittenAuthorizationReference({ CFR_WRITTEN_AUTHORIZATION_REF: '---' }))
      .toBe(false)
    expect(hasCfrWrittenAuthorizationReference({ CFR_WRITTEN_AUTHORIZATION_REF: 'approval-42' }))
      .toBe(true)
  })

  it('requires both explicit enablement and written-authorization reference', () => {
    expect(cfrWebAdapterEnabled({
      ENABLE_CFR_WEB_ADAPTER: 'true',
    })).toBe(false)
    expect(cfrWebAdapterEnabled({
      ENABLE_CFR_WEB_ADAPTER: 'false',
      CFR_WRITTEN_AUTHORIZATION_REF: 'approval-42',
    })).toBe(false)
    expect(cfrWebAdapterEnabled({
      ENABLE_CFR_WEB_ADAPTER: 'true',
      CFR_WRITTEN_AUTHORIZATION_REF: '<approval-document-or-ticket-reference>',
    })).toBe(false)
    expect(cfrWebAdapterEnabled({
      ENABLE_CFR_WEB_ADAPTER: 'true',
      CFR_WRITTEN_AUTHORIZATION_REF: ' approval-42 ',
    })).toBe(true)
  })
})
