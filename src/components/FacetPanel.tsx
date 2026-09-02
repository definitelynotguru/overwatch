import type { ParsedQuery, SearchResult } from '../domain/types'
import { getAssetType } from '../domain/catalog'

type Props = {
  data: SearchResult | null
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

export function FacetPanel({ data, typeFilter, operatorFilter, onType, onOperator }: Props) {
  if (!data) {
    return (
      <aside className="facets">
        <div className="section-label">Results</div>
        <div className="results-count">—</div>
      </aside>
    )
  }

  const types = Object.entries(data.stats.types).sort((a, b) => b[1] - a[1])
  const operators = Object.entries(data.stats.operators).sort((a, b) => b[1] - a[1])

  return (
    <aside className="facets">
      <div className="section-label">Results</div>
      <div className="results-count">{data.stats.total.toLocaleString()}</div>

      {types.length > 0 && (
        <>
          <div className="section-label">Asset type</div>
          {types.map(([id, n]) => (
            <button
              key={id}
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
          <div className="section-label">Operator</div>
          {operators.map(([id, n]) => (
            <button
              key={id}
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
