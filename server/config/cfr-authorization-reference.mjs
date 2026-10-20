const TEMPLATE_VALUES = new Set([
  'approval document or ticket reference',
  'approval reference',
  'authorization reference',
  'written authorization reference',
  'enter approval reference',
  'your approval reference',
  'your authorization reference',
  'your ticket reference',
  'placeholder',
  'example',
  'todo',
  'tbd',
  'replace me',
  'change me',
])

/** Reject empty/template values; the referenced written approval still needs human verification. */
export function hasConfiguredCfrAuthorizationReference(value) {
  if (typeof value !== 'string') return false

  const trimmed = value.trim()
  if (!trimmed || /[<>\{\}]/.test(trimmed)) return false

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!normalized) return false
  if (TEMPLATE_VALUES.has(normalized)) return false
  if (/^(todo|tbd|placeholder|example|test|your|replace me|change me)(?:\b|$)/.test(normalized)) {
    return false
  }

  return true
}
