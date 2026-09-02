import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SearchHeader } from '../components/SearchHeader'
import { FacetPanel } from '../components/FacetPanel'
import { ResultList } from '../components/ResultList'
import { isSearchError, type Asset, type SearchError, type SearchResult } from '../domain/types'

const MapPane = lazy(() => import('../components/MapPane').then((m) => ({ default: m.MapPane })))

type Search = { q: string }

export const Route = createFileRoute('/')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === 'string' ? s.q : '',
  }),
  component: Home,
})

async function fetchSearch(q: string): Promise<SearchResult | SearchError> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  return (await res.json()) as SearchResult | SearchError
}

function Home() {
  const { q } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [mounted, setMounted] = useState(false)
  const [cluster, setCluster] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<Asset | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [operatorFilter, setOperatorFilter] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    setTypeFilter(null)
    setOperatorFilter(null)
    setSelectedId(null)
    setFlyTo(null)
  }, [q])

  const query = useQuery({
    queryKey: ['search', q],
    queryFn: () => fetchSearch(q),
    enabled: q.length > 0,
  })

  const payload = query.data
  const result = payload && !isSearchError(payload) ? payload : null
  const err = payload && isSearchError(payload) ? payload : null

  const assets = useMemo(() => {
    if (!result) return []
    return result.results.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false
      if (operatorFilter) {
        const op = a.operator?.trim() ? a.operator : 'Unknown'
        if (op !== operatorFilter) return false
      }
      return true
    })
  }, [result, typeFilter, operatorFilter])

  function runSearch(next: string) {
    void navigate({ search: { q: next }, replace: true })
  }

  return (
    <div className="app">
      <SearchHeader query={q} onSearch={runSearch} onClear={() => runSearch('')} />
      <div className="workspace">
        <FacetPanel
          data={result}
          typeFilter={typeFilter}
          operatorFilter={operatorFilter}
          onType={setTypeFilter}
          onOperator={setOperatorFilter}
        />

        {!q && (
          <section className="results">
            <div className="empty">
              <h2>Search infrastructure</h2>
              <p>Queries need an asset type or operator, and a place.</p>
              <ul>
                <li>
                  <code>airports near london</code>
                </li>
                <li>
                  <code>bridges in new york</code>
                </li>
                <li>
                  <code>telecom towers in karnataka</code>
                </li>
                <li>
                  <code>type:airport near:london radius:50</code>
                </li>
              </ul>
              <p>Enter searches. Escape clears. Share copies the URL.</p>
            </div>
          </section>
        )}

        {q && query.isFetching && (
          <section className="results">
            <div className="status">Searching…</div>
          </section>
        )}

        {q && !query.isFetching && err && (
          <section className="results">
            <div className="error">{err.error}</div>
          </section>
        )}

        {q && !query.isFetching && result && result.stats.total === 0 && (
          <section className="results">
            <div className="empty">
              <h2>No assets matched</h2>
              <p>Nothing in the seeded catalog for this query. Try a broader radius or another place.</p>
            </div>
          </section>
        )}

        {q && !query.isFetching && result && result.stats.total > 0 && (
          <ResultList
            total={assets.length === result.results.length ? result.stats.total : assets.length}
            assets={assets}
            selectedId={selectedId}
            onSelect={(asset) => {
              setSelectedId(asset.id)
              setFlyTo(asset)
            }}
          />
        )}

        {mounted ? (
          <Suspense fallback={<div className="map-pane" />}>
          <MapPane
            assets={assets}
            cluster={cluster}
            selectedId={selectedId}
            flyTo={flyTo}
            onClusterChange={setCluster}
            onSelect={(id) => {
              setSelectedId(id)
              const asset = assets.find((a) => a.id === id)
              if (asset) {
                const el = document.querySelector('.card.selected')
                el?.scrollIntoView({ block: 'nearest' })
              }
            }}
          />
          </Suspense>
        ) : (
          <div className="map-pane" />
        )}
      </div>
    </div>
  )
}
