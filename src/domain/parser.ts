import { resolveOperator, resolveType, typePhrases } from './catalog'
import type { JoinHop, ParsedQuery } from './types'

const TYPE_PHRASES = typePhrases()

const KEY_VALUE = /(?:^|\s)(type|operator|region|country|near|radius):(?:"([^"]*)"|([^\s]+))/gi
const NEAR = /\bnear\s+(.+?)(?:\s+(?:in|within|radius)\b|$)/i
const IN = /\bin\s+(.+?)(?:\s+(?:near|within|radius)\b|$)/i
const RADIUS = /(?:within|radius)\s*[:=]?\s*(\d+)\s*(?:km|kilometers?|kilometres?)?/i
const HOP_PREFIX =
  /\bwithin\s*[:=]?\s*(\d+)\s*(?:km|kilometers?|kilometres?)?\s+of\s+/i
const STOP = /\b(the|a|an|all|show|find|search|get|list|of|for)\b/gi
const MAX_HOPS = 3

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanPlace(raw: string): string {
  return raw
    .replace(RADIUS, ' ')
    .replace(STOP, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchHopType(afterOf: string): { type: string; consumed: number } | null {
  for (const { phrase, id } of TYPE_PHRASES) {
    const re = new RegExp(`^(${escapeRe(phrase)}s?)\\b`, 'i')
    const m = afterOf.match(re)
    if (m) return { type: id, consumed: m[0].length }
  }
  const token = afterOf.match(/^[\p{L}\p{N}_-]+/u)
  if (!token) return null
  const resolved = resolveType(token[0]!)
  if (!resolved) return null
  return { type: resolved, consumed: token[0]!.length }
}

function extractHops(text: string): { hops: JoinHop[]; rest: string } {
  const hops: JoinHop[] = []
  let rest = text
  let searchFrom = 0
  while (hops.length < MAX_HOPS) {
    const slice = rest.slice(searchFrom)
    const m = slice.match(HOP_PREFIX)
    if (!m || m.index == null) break
    const absIndex = searchFrom + m.index
    const afterOf = rest.slice(absIndex + m[0].length)
    const hopType = matchHopType(afterOf)
    if (!hopType) {
      searchFrom = absIndex + m[0].length
      continue
    }
    const n = parseInt(m[1]!, 10)
    const km = Number.isFinite(n) ? Math.min(Math.max(n, 1), 500) : 50
    hops.push({ type: hopType.type, withinM: km * 1000 })
    const hopEnd = absIndex + m[0].length + hopType.consumed
    rest = `${rest.slice(0, absIndex)} ${rest.slice(hopEnd)}`.replace(/\s+/g, ' ').trim()
    searchFrom = Math.min(absIndex, rest.length)
  }
  return { hops, rest }
}

export function parseQuery(input: string): ParsedQuery {
  const raw = input.trim()
  const result: ParsedQuery = {
    type: null,
    operator: null,
    region: null,
    country: null,
    near: null,
    radius: 50,
    hops: [],
    raw,
  }
  if (!raw) return result

  let rest = raw
  let structuredRadius = false
  for (const match of raw.matchAll(KEY_VALUE)) {
    const key = match[1]!.toLowerCase()
    const val = (match[2] ?? match[3] ?? '').replace(/_/g, ' ')
    if (key === 'type') result.type = resolveType(val)
    else if (key === 'operator') result.operator = val.toLowerCase()
    else if (key === 'region') result.region = val
    else if (key === 'country') result.country = val
    else if (key === 'near') result.near = val
    else if (key === 'radius') {
      const n = parseInt(val, 10)
      if (Number.isFinite(n)) {
        result.radius = Math.min(Math.max(n, 1), 500)
        structuredRadius = true
      }
    }
    rest = rest.replace(match[0]!, ' ')
  }
  rest = rest.replace(/\s+/g, ' ').trim()

  const extracted = extractHops(rest)
  result.hops = extracted.hops
  rest = extracted.rest

  if (!result.type) {
    const lower = rest.toLowerCase()
    for (const { phrase, id } of TYPE_PHRASES) {
      const re = new RegExp(`\\b${escapeRe(phrase)}s?\\b`, 'i')
      if (re.test(lower)) {
        result.type = id
        rest = rest.replace(re, ' ')
        break
      }
    }
  }

  if (!result.operator) {
    result.operator = resolveOperator(rest) ?? resolveOperator(raw)
  }

  const radiusHit = rest.match(RADIUS) ?? (result.hops.length === 0 ? raw.match(RADIUS) : null)
  if (radiusHit) {
    if (!structuredRadius) {
      const n = parseInt(radiusHit[1]!, 10)
      if (Number.isFinite(n)) result.radius = Math.min(Math.max(n, 1), 500)
    }
    rest = rest.replace(radiusHit[0], ' ')
  }

  if (!result.near) {
    const nearHit = rest.match(NEAR) ?? raw.match(NEAR)
    if (nearHit) result.near = cleanPlace(nearHit[1] ?? '') || null
  }
  if (!result.region && !result.country) {
    const inHit = rest.match(IN) ?? raw.match(IN)
    if (inHit) result.region = cleanPlace(inHit[1] ?? '') || null
  }

  return result
}

export function validateQuery(parsed: ParsedQuery): { valid: boolean; error?: string } {
  if (!parsed.type && !parsed.operator) {
    return {
      valid: false,
      error:
        'Query must specify an asset type or operator. Try "airports near london" or "type:data_center region:mumbai".',
    }
  }
  if (!parsed.region && !parsed.near && !parsed.country) {
    return {
      valid: false,
      error:
        'Query must specify a geographic scope. Try "in karnataka", "near london", or "country:india".',
    }
  }
  return { valid: true }
}
