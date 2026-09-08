import { useEffect, useRef, type MutableRefObject } from 'react'
import type { Asset, RelatedAssets } from '../domain/types'
import { getAssetType } from '../domain/catalog'
import { HOP_COLORS, formatWithinM } from '../domain/hops'

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

function AssetCard({
  asset,
  selected,
  selectedRef,
  onSelect,
  badge,
}: {
  asset: Asset
  selected: boolean
  selectedRef: MutableRefObject<HTMLElement | null>
  onSelect: (asset: Asset) => void
  badge?: string
}) {
  return (
    <article
      className={selected ? 'card selected' : 'card'}
      ref={selected ? (el) => { selectedRef.current = el } : undefined}
      onClick={() => onSelect(asset)}
    >
      <div>
        <div className="card-title">{asset.name ?? 'Unnamed'}</div>
        <div className="card-meta">
          {asset.lat.toFixed(5)}, {asset.lon.toFixed(5)}
          {asset.operator ? ` · ${asset.operator}` : ''}
        </div>
        <div className="tags">
          {usefulTags(asset.tags).map(([k, v]) => (
            <span className="tag" key={k}>
              {k}: {v}
            </span>
          ))}
        </div>
      </div>
      <span className="badge">{badge ?? getAssetType(asset.type)?.id ?? asset.type}</span>
    </article>
  )
}

type Props = {
  total: number
  assets: Asset[]
  related?: RelatedAssets[]
  selectedId: string | null
  onSelect: (asset: Asset) => void
}

const EMPTY_RELATED: RelatedAssets[] = []

export function ResultList({ total, assets, related = EMPTY_RELATED, selectedId, onSelect }: Props) {
  const selectedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <section className="results">
      <div className="results-head">
        {total.toLocaleString()} result{total === 1 ? '' : 's'}
        {assets.length < total ? ` · showing ${assets.length}` : ''}
        {related.some((r) => r.assets.length > 0)
          ? ` · ${related.reduce((n, r) => n + r.assets.length, 0)} related`
          : ''}
      </div>
      {assets.map((a) => (
        <AssetCard
          key={a.id}
          asset={a}
          selected={a.id === selectedId}
          selectedRef={selectedRef}
          onSelect={onSelect}
        />
      ))}
      {related.map((hop, i) => {
        if (hop.assets.length === 0) return null
        const color = HOP_COLORS[i] ?? HOP_COLORS[HOP_COLORS.length - 1]!
        return (
          <div className="hop-group" key={`${hop.type}-${hop.withinM}-${i}`}>
            <div className="hop-head">
              <span className="hop-swatch" style={{ background: color }} />
              <span>
                {hop.type} · within {formatWithinM(hop.withinM)}
                {' · '}
                {hop.assets.length}
              </span>
            </div>
            {hop.assets.map((a) => (
              <AssetCard
                key={`hop-${i}-${a.id}`}
                asset={a}
                selected={a.id === selectedId}
                selectedRef={selectedRef}
                onSelect={onSelect}
                badge={getAssetType(a.type)?.id ?? a.type}
              />
            ))}
          </div>
        )
      })}
    </section>
  )
}
