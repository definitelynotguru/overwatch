import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Asset } from '../domain/types'

const STYLE = 'https://tiles.openfreemap.org/styles/dark'

type Props = {
  assets: Asset[]
  cluster: boolean
  selectedId: string | null
  flyTo: Asset | null
  onSelect: (id: string) => void
  onClusterChange: (cluster: boolean) => void
}

function toGeoJSON(assets: Asset[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: assets.map((a) => ({
      type: 'Feature',
      id: a.id,
      properties: { id: a.id, name: a.name, type: a.type },
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
    })),
  }
}

function addLayers(map: maplibregl.Map, cluster: boolean) {
  map.addSource('hits', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  })

  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'hits',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#60a5fa',
        8,
        '#fbbf24',
        25,
        '#f97316',
      ],
      'circle-radius': ['step', ['get', 'point_count'], 16, 8, 20, 25, 26],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#0b0b0b',
    },
  })

  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'hits',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['to-string', ['get', 'point_count']],
      'text-size': 12,
      'text-font': ['Noto Sans Regular'],
    },
    paint: { 'text-color': '#111111' },
  })

  map.addLayer({
    id: 'points',
    type: 'circle',
    source: 'hits',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#3b82f6',
      'circle-radius': 6,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    },
  })
}

export function MapPane({
  assets,
  cluster,
  selectedId,
  flyTo,
  onSelect,
  onClusterChange,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!host.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: host.current,
      style: STYLE,
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      addLayers(map, cluster)
      const src = map.getSource('hits') as maplibregl.GeoJSONSource | undefined
      src?.setData(toGeoJSON(assets))
    })
    map.on('click', 'clusters', (e) => {
      const feature = e.features?.[0]
      const id = feature?.properties?.cluster_id
      const coords = (feature?.geometry as GeoJSON.Point | undefined)?.coordinates
      if (id == null || !coords) return
      const source = map.getSource('hits') as maplibregl.GeoJSONSource
      source.getClusterExpansionZoom(id, (err, zoom) => {
        if (err || zoom == null) return
        map.easeTo({ center: coords as [number, number], zoom })
      })
    })
    map.on('click', 'points', (e) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') onSelectRef.current(id)
    })
    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('mouseenter', 'points', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'points', () => {
      map.getCanvas().style.cursor = ''
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // cluster is applied via a later effect that rebuilds the source
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    if (!map.getSource('hits')) return
    map.removeLayer('cluster-count')
    map.removeLayer('clusters')
    map.removeLayer('points')
    map.removeSource('hits')
    addLayers(map, cluster)
    ;(map.getSource('hits') as maplibregl.GeoJSONSource).setData(toGeoJSON(assets))
  }, [cluster])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getSource('hits')) return
    ;(map.getSource('hits') as maplibregl.GeoJSONSource).setData(toGeoJSON(assets))
    if (assets.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    for (const a of assets) bounds.extend([a.lon, a.lat])
    map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 600 })
  }, [assets])

  useEffect(() => {
    if (!flyTo || !mapRef.current) return
    mapRef.current.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 13, speed: 1.2 })
  }, [flyTo])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('points')) return
    map.setPaintProperty('points', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      9,
      6,
    ])
    map.setPaintProperty('points', 'circle-color', [
      'case',
      ['==', ['get', 'id'], selectedId ?? ''],
      '#fbbf24',
      '#3b82f6',
    ])
  }, [selectedId])

  return (
    <div className="map-pane">
      <div className="map-root" ref={host} />
      <label className="map-cluster-toggle">
        <input
          type="checkbox"
          checked={cluster}
          onChange={(e) => onClusterChange(e.target.checked)}
        />
        Cluster markers
      </label>
      <div className="map-attrib">
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
        {' · '}
        <a href="https://www.openmaptiles.org" target="_blank" rel="noreferrer">
          OpenMapTiles
        </a>
        {' · '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
      </div>
    </div>
  )
}
