import type { AssetType } from './catalog'

export type { AssetType }

export type ParsedQuery = {
  type: string | null
  operator: string | null
  region: string | null
  country: string | null
  near: string | null
  radius: number
  raw: string
}

export type Asset = {
  id: string
  osmType: string
  osmId: number
  name: string | null
  type: string
  operator: string | null
  lat: number
  lon: number
  tags: Record<string, string>
}

export type SearchStats = {
  total: number
  types: Record<string, number>
  operators: Record<string, number>
}

export type SearchResult = {
  results: Asset[]
  stats: SearchStats
  bounds: [number, number, number, number] | null
  query: ParsedQuery
  place: { name: string; kind: string; lat: number; lon: number } | null
}

export type SearchError = {
  error: string
  code: string
  query: ParsedQuery
}

export function isSearchError(v: SearchResult | SearchError): v is SearchError {
  return 'error' in v
}
