import { useEffect, useRef } from 'react'
import type { Asset } from '../domain/types'
import { getAssetType } from '../domain/catalog'

const SKIP = new Set(['name'])

function usefulTags(tags: Record<string, string>): [string, string][] {
  const rows: [string, string][] = []
  for (const [k, v] of Object.entries(tags)) {
    if (SKIP.has(k) || !v) continue
    if (v.length > 48) continue
    rows.push([k, v])
    if (rows.length >= 4) break
  }
  return rows
}

type Props = {
  total: number
  assets: Asset[]
  selectedId: string | null
  onSelect: (asset: Asset) => void
}

export function ResultList({ total, assets, selectedId, onSelect }: Props) {
  const selectedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <section className="results">
      <div className="results-head">
        {total.toLocaleString()} result{total === 1 ? '' : 's'}
        {assets.length < total ? ` · showing ${assets.length}` : ''}
      </div>
      {assets.map((a) => {
        const selected = a.id === selectedId
        return (
          <article
            key={a.id}
            className={selected ? 'card selected' : 'card'}
            ref={selected ? (el) => { selectedRef.current = el } : undefined}
            onClick={() => onSelect(a)}
          >
            <div>
              <div className="card-title">{a.name ?? 'Unnamed'}</div>
              <div className="card-meta">
                {a.lat.toFixed(5)}, {a.lon.toFixed(5)}
                {a.operator ? ` · ${a.operator}` : ''}
              </div>
              <div className="tags">
                {usefulTags(a.tags).map(([k, v]) => (
                  <span className="tag" key={k}>
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
            <span className="badge">{getAssetType(a.type)?.id ?? a.type}</span>
          </article>
        )
      })}
    </section>
  )
}
