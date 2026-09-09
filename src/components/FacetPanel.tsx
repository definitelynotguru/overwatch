import type { ParsedQuery, RelatedAssets, SearchResult } from '../domain/types'
import { getAssetType } from '../domain/catalog'

type Props = {
  data: SearchResult | null
  /** Filtered related hops (for mixRelated label); falls back to data.related. */
  relatedForLabel?: RelatedAssets[]
  typeFilter: string | null
  operatorFilter: string | null
  onType: (t: string | null) => void
  onOperator: (o: string | null) => void
}

function kv(query: ParsedQuery): [string, string][] {
  const rows: [string, string][] = []
  if (query.type) rows.push(['type', query.type])
  if (query.operator) rows.push(['operator', query.operator])
  if (query.region) rows.push(['region', query.region])
  if (query.country) rows.push(['country', query.country])
  if (query.near) rows.push(['near', query.near])
  if (query.near) rows.push(['radius', String(query.radius)])
  return rows
}

function sortOperators(entries: [string, number][]): [string, number][] {
  return [...entries].sort((a, b) => {
    const aUnknown = a[0] === 'Unknown' ? 1 : 0
    const bUnknown = b[0] === 'Unknown' ? 1 : 0
    if (aUnknown !== bUnknown) return aUnknown - bUnknown
    return b[1] - a[1]
  })
}

export function FacetPanel({ data, relatedForLabel, typeFilter, operatorFilter, onType, onOperator }: Props) {
  if (!data) {
    return (
      <aside className="facets">
        <div className="section-label">Filters</div>
        <p className="facets-empty">Run a search to filter by type and operator.</p>
      </aside>
    )
  }

  const types = Object.entries(data.stats.types).sort((a, b) => b[1] - a[1])
  const operators = sortOperators(Object.entries(data.stats.operators))
  const mixRelated = (relatedForLabel ?? data.related).some((r) => r.assets.length > 0)

  return (
    <aside className="facets">
      {types.length > 0 && (
        <>
          <div className="section-label">
            {mixRelated ? 'Asset type · incl. related' : 'Asset type'}
          </div>
          {types.map(([id, n]) => (
            <button
              key={id}
              type="button"
              aria-pressed={typeFilter === id}
              className={typeFilter === id ? 'facet-row active' : 'facet-row'}
              onClick={() => onType(typeFilter === id ? null : id)}
            >
              <span className="facet-name">{getAssetType(id)?.label ?? id}</span>
              <span className="n">{n.toLocaleString()}</span>
            </button>
          ))}
        </>
      )}

      {operators.length > 0 && (
        <>
          <div className="section-label">
            {mixRelated ? 'Operator · incl. related' : 'Operator'}
          </div>
          {operators.map(([id, n]) => (
            <button
              key={id}
              type="button"
              aria-pressed={operatorFilter === id}
              className={operatorFilter === id ? 'facet-row active' : 'facet-row'}
              onClick={() => onOperator(operatorFilter === id ? null : id)}
            >
              <span className="facet-name">{id}</span>
              <span className="n">{n.toLocaleString()}</span>
            </button>
          ))}
        </>
      )}

      <div className="section-label">Query</div>
      <div className="query-box">
        {kv(data.query).map(([k, v]) => (
          <div key={k}>
            {k} {v}
          </div>
        ))}
      </div>
    </aside>
  )
}
