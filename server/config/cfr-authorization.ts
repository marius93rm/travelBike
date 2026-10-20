import { hasConfiguredCfrAuthorizationReference } from './cfr-authorization-reference.mjs'

export interface CfrAuthorizationEnvironment {
  ENABLE_CFR_WEB_ADAPTER?: string
  CFR_WRITTEN_AUTHORIZATION_REF?: string
}

export function hasCfrWrittenAuthorizationReference(env: CfrAuthorizationEnvironment) {
  return hasConfiguredCfrAuthorizationReference(env.CFR_WRITTEN_AUTHORIZATION_REF)
}

export function cfrWebAdapterEnabled(env: CfrAuthorizationEnvironment) {
  return env.ENABLE_CFR_WEB_ADAPTER === 'true'
    && hasCfrWrittenAuthorizationReference(env)
}
